package com.novastage.novaredline

import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.ByteOrder
import kotlin.math.*

data class NovaAudioStats(val lufsI: Double, val truePeakDbtp: Double)

data class NovaPreparedSource(
    val rawPcm: File,
    val sourceSampleRate: Int,
    val sourceFrames: Long,
    val sourceStats: NovaAudioStats
)

data class NovaMasterResult(
    val file: File,
    val sourceStats: NovaAudioStats,
    val processedStats: NovaAudioStats,
    val finalStats: NovaAudioStats,
    val appliedGainDb: Double,
    val targetLufs: Double,
    val ceilingDbtp: Double,
    val limiterStats: NovaLimiterStats,
    val finalShortTermLufs: Double,
    val finalMomentaryLufs: Double
)

class NovaOfflineMasterEngine(private val context: Context) {
    companion object { const val OUTPUT_SAMPLE_RATE = 48_000 }

    suspend fun prepareSource(uri: Uri, progress: (Float, String) -> Unit = { _, _ -> }): NovaPreparedSource =
        withContext(Dispatchers.IO) {
            val cc = currentCoroutineContext()
            val dir = File(context.cacheDir, "nova_decode").apply { mkdirs() }
            val raw = File(dir, "source_${System.nanoTime()}.pcm")
            progress(.02f, "DECODING AUDIO")
            val info = decodeToStereoPcm16(uri, raw) { p ->
                cc.ensureActive(); progress(.02f + p * .50f, "DECODING AUDIO")
            }

            val meter = NovaMeter(OUTPUT_SAMPLE_RATE)
            NovaSincResampler(StereoPcmSource(raw, info.frames), info.sampleRate, OUTPUT_SAMPLE_RATE).use { rs ->
                val total = rs.outputFrames.coerceAtLeast(1L)
                var n = 0L
                while (true) {
                    val f = rs.next() ?: break
                    meter.add(f.l, f.r); n++
                    if (n % 24_000L == 0L) {
                        cc.ensureActive()
                        progress(.54f + .45f * (n.toDouble() / total).coerceIn(0.0, 1.0).toFloat(), "SOURCE ANALYSIS")
                    }
                }
            }
            progress(1f, "ANALYSIS COMPLETE")
            NovaPreparedSource(raw, info.sampleRate, info.frames, meter.finish())
        }

    suspend fun renderMaster(
        prepared: NovaPreparedSource,
        params: NovaDspParams,
        targetLufs: Double,
        ceilingDbtp: Double,
        progress: (Float, String) -> Unit = { _, _ -> }
    ): NovaMasterResult = withContext(Dispatchers.IO) {
        val cc = currentCoroutineContext()
        val processedMeter = NovaMeter(OUTPUT_SAMPLE_RATE)
        val dspA = CleanDsp(params, OUTPUT_SAMPLE_RATE)
        val dynA = Nova3ZoneDynamics(OUTPUT_SAMPLE_RATE, params.dynamicEqPercent, params.gluePercent)

        NovaSincResampler(StereoPcmSource(prepared.rawPcm, prepared.sourceFrames), prepared.sourceSampleRate, OUTPUT_SAMPLE_RATE).use { rs ->
            val total = rs.outputFrames.coerceAtLeast(1L)
            var n = 0L
            while (true) {
                val f = rs.next() ?: break
                val t = dspA.process(f.l, f.r)
                val y = if (params.bypass) t else dynA.process(t.l, t.r)
                processedMeter.add(y.l, y.r); n++
                if (n % 24_000L == 0L) {
                    cc.ensureActive(); progress(.02f + .40f * (n.toDouble() / total).toFloat(), "CLEAN CORE ANALYSIS")
                }
            }
        }

        val processed = processedMeter.finish()
        val ceiling = min(ceilingDbtp, -1.3)
        val minPlr = 9.6
        val maxLift = 5.8
        val peakBudget = 2.9
        val plrTarget = ceiling - minPlr
        val peakLift = (ceiling + peakBudget - processed.truePeakDbtp).coerceIn(0.0, 12.0)
        val safeTarget = minOf(targetLufs, plrTarget, processed.lufsI + maxLift, processed.lufsI + peakLift)
        val gainDb = NovaLoudnessMaximizer.computeGainDb(processed.lufsI, safeTarget, maxLift)
        val gain = 10.0.pow(gainDb / 20.0)

        val outDir = File(context.cacheDir, "masters").apply { mkdirs() }
        val out = File(outDir, "NOVA_RED_LINE_${System.currentTimeMillis()}_48k24.wav")
        val dsp = CleanDsp(params, OUTPUT_SAMPLE_RATE)
        val dyn = Nova3ZoneDynamics(OUTPUT_SAMPLE_RATE, params.dynamicEqPercent, params.gluePercent)
        val limiter = NovaTruePeakLimiter8x(OUTPUT_SAMPLE_RATE, ceiling, 5.0, 210.0)
        val finalMeter = NovaMeter(OUTPUT_SAMPLE_RATE)
        val windows = NovaRealtimeLoudnessWindows(OUTPUT_SAMPLE_RATE)

        Wav24Writer(out, OUTPUT_SAMPLE_RATE).use { wav ->
            NovaSincResampler(StereoPcmSource(prepared.rawPcm, prepared.sourceFrames), prepared.sourceSampleRate, OUTPUT_SAMPLE_RATE).use { rs ->
                val total = rs.outputFrames.coerceAtLeast(1L)
                var n = 0L
                while (true) {
                    val f = rs.next() ?: break
                    val t = dsp.process(f.l, f.r)
                    val c = if (params.bypass) t else dyn.process(t.l, t.r)
                    val y = limiter.process(c.l * gain, c.r * gain)
                    if (n >= limiter.latencyFrames) {
                        wav.write(y.l, y.r); finalMeter.add(y.l, y.r); windows.add(y.l, y.r)
                    }
                    n++
                    if (n % 24_000L == 0L) {
                        cc.ensureActive(); progress(.45f + .54f * (n.toDouble() / total).toFloat(), "TRUE PEAK FINAL")
                    }
                }
            }
            repeat(limiter.latencyFrames) {
                val y = limiter.process(0.0, 0.0)
                wav.write(y.l, y.r); finalMeter.add(y.l, y.r); windows.add(y.l, y.r)
            }
        }

        val finalStats = finalMeter.finish()
        progress(1f, "MASTER COMPLETE")
        NovaMasterResult(
            out, prepared.sourceStats, processed, finalStats, gainDb, safeTarget, ceiling,
            limiter.stats(), windows.shortTermLufs(), windows.momentaryLufs()
        )
    }

    fun cleanup(prepared: NovaPreparedSource?) { runCatching { prepared?.rawPcm?.delete() } }

    private data class DecodeInfo(val sampleRate: Int, val frames: Long)

    private fun decodeToStereoPcm16(uri: Uri, out: File, progress: (Float) -> Unit): DecodeInfo {
        val ex = MediaExtractor(); ex.setDataSource(context, uri, null)
        var track = -1; var fmt: MediaFormat? = null
        for (i in 0 until ex.trackCount) {
            val f = ex.getTrackFormat(i); val mime = f.getString(MediaFormat.KEY_MIME).orEmpty()
            if (mime.startsWith("audio/")) { track = i; fmt = f; break }
        }
        require(track >= 0 && fmt != null) { "지원되는 오디오 트랙이 없습니다." }
        ex.selectTrack(track)
        val mime = fmt!!.getString(MediaFormat.KEY_MIME)!!
        val duration = if (fmt!!.containsKey(MediaFormat.KEY_DURATION)) fmt!!.getLong(MediaFormat.KEY_DURATION) else 0L
        val codec = MediaCodec.createDecoderByType(mime)
        codec.configure(fmt, null, null, 0); codec.start()
        val info = MediaCodec.BufferInfo()
        var inputDone = false; var outputDone = false
        var rate = fmt!!.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        var channels = fmt!!.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        var pcmEncoding = AudioFormat.ENCODING_PCM_16BIT
        var frames = 0L

        FileOutputStream(out).buffered(128 * 1024).use { os ->
            while (!outputDone) {
                if (!inputDone) {
                    val idx = codec.dequeueInputBuffer(10_000)
                    if (idx >= 0) {
                        val b = codec.getInputBuffer(idx)!!
                        val size = ex.readSampleData(b, 0)
                        if (size < 0) {
                            codec.queueInputBuffer(idx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM); inputDone = true
                        } else {
                            codec.queueInputBuffer(idx, 0, size, ex.sampleTime, 0); ex.advance()
                        }
                    }
                }
                when (val oi = codec.dequeueOutputBuffer(info, 10_000)) {
                    MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        val of = codec.outputFormat
                        if (of.containsKey(MediaFormat.KEY_SAMPLE_RATE)) rate = of.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                        if (of.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) channels = of.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                        if (of.containsKey(MediaFormat.KEY_PCM_ENCODING)) pcmEncoding = of.getInteger(MediaFormat.KEY_PCM_ENCODING)
                    }
                    else -> if (oi >= 0) {
                        val b = codec.getOutputBuffer(oi)!!
                        b.position(info.offset); b.limit(info.offset + info.size); b.order(ByteOrder.nativeOrder())
                        if (pcmEncoding == AudioFormat.ENCODING_PCM_FLOAT) {
                            val fb = b.asFloatBuffer(); val samples = fb.remaining() / max(1, channels)
                            repeat(samples) {
                                val vals = FloatArray(channels) { fb.get() }
                                val l = vals[0].toDouble(); val r = if (channels > 1) vals[1].toDouble() else l
                                writePcm16(os, l, r); frames++
                            }
                        } else {
                            val sb = b.asShortBuffer(); val samples = sb.remaining() / max(1, channels)
                            repeat(samples) {
                                val vals = ShortArray(channels) { sb.get() }
                                val l = vals[0].toInt(); val r = if (channels > 1) vals[1].toInt() else l
                                os.write(l and 0xff); os.write((l ushr 8) and 0xff); os.write(r and 0xff); os.write((r ushr 8) and 0xff); frames++
                            }
                        }
                        if (duration > 0) progress((info.presentationTimeUs.toDouble() / duration).coerceIn(0.0, 1.0).toFloat())
                        outputDone = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
                        codec.releaseOutputBuffer(oi, false)
                    }
                }
            }
        }
        codec.stop(); codec.release(); ex.release(); progress(1f)
        return DecodeInfo(rate, frames)
    }

    private fun writePcm16(os: java.io.OutputStream, l: Double, r: Double) {
        fun q(v: Double) = (v.coerceIn(-1.0, .999969) * 32768.0).roundToInt().coerceIn(-32768, 32767)
        val a = q(l); val b = q(r)
        os.write(a and 0xff); os.write((a ushr 8) and 0xff); os.write(b and 0xff); os.write((b ushr 8) and 0xff)
    }
}

private class CleanDsp(params: NovaDspParams, sampleRate: Int) {
    private val l = Array(11) { Biquad() }; private val r = Array(11) { Biquad() }
    private val width = (params.widthPercent / 100.0).coerceIn(.6, 1.5)
    init {
        val g = params.eqDb
        fun set(i: Int, type: Biquad.Type, f: Double, q: Double, db: Double) { l[i].configure(type, sampleRate.toDouble(), f, q, db); r[i].configure(type, sampleRate.toDouble(), f, q, db) }
        set(0, Biquad.Type.LOW_SHELF,45.0,.7,g.getOrElse(0){0f}.toDouble()); set(1,Biquad.Type.PEAK,100.0,.8,g.getOrElse(1){0f}.toDouble())
        set(2,Biquad.Type.PEAK,250.0,.8,g.getOrElse(2){0f}.toDouble()); set(3,Biquad.Type.PEAK,800.0,.8,g.getOrElse(3){0f}.toDouble())
        set(4,Biquad.Type.PEAK,2500.0,.8,g.getOrElse(4){0f}.toDouble()); set(5,Biquad.Type.PEAK,7000.0,.8,g.getOrElse(5){0f}.toDouble())
        set(6,Biquad.Type.HIGH_SHELF,12000.0,.7,g.getOrElse(6){0f}.toDouble())
        set(7,Biquad.Type.LOW_SHELF,90.0,.7,params.lowDb.toDouble()); set(8,Biquad.Type.PEAK,2800.0,.8,params.vocalDb.toDouble())
        set(9,Biquad.Type.HIGH_SHELF,12000.0,.7,params.airDb.toDouble()); set(10,Biquad.Type.PEAK,5200.0,.9,-(params.deHarshPercent/100.0)*4.5)
    }
    fun process(left: Double, right: Double): NovaStereoSample {
        if (left.isNaN() || right.isNaN()) return NovaStereoSample(0.0,0.0)
        var a=left; var b=right; l.forEach{a=it.process(a)}; r.forEach{b=it.process(b)}
        val mid=(a+b)*.5; val side=(a-b)*.5*width
        return NovaStereoSample(mid+side, mid-side)
    }
}

private class NovaMeter(sampleRate: Int) {
    private val loud = KWeightLoudness(sampleRate); private val tp = TruePeakMeter()
    fun add(l: Double,r: Double){ loud.add(l,r); tp.add(l,r) }
    fun finish()=NovaAudioStats(loud.finish(),tp.finish())
}

private class KWeightLoudness(sampleRate: Int) {
    private val n=(sampleRate*.400).roundToInt().coerceAtLeast(1); private val step=(sampleRate*.100).roundToInt().coerceAtLeast(1)
    private val ring=DoubleArray(n); private var p=0; private var filled=0; private var sum=0.0; private var since=0
    private val ls=Biquad().apply{configure(Biquad.Type.HIGH_SHELF,sampleRate.toDouble(),1681.974,.707,4.0)}
    private val lh=Biquad().apply{configureHighPass(sampleRate.toDouble(),38.135,.5)}
    private val rs=Biquad().apply{configure(Biquad.Type.HIGH_SHELF,sampleRate.toDouble(),1681.974,.707,4.0)}
    private val rh=Biquad().apply{configureHighPass(sampleRate.toDouble(),38.135,.5)}
    private val blocks=ArrayList<Double>()
    fun add(l:Double,r:Double){ val a=lh.process(ls.process(l)); val b=rh.process(rs.process(r)); val e=a*a+b*b
        if(filled<n){filled++}else sum-=ring[p]; ring[p]=e; sum+=e; p=(p+1)%n
        if(filled==n && ++since>=step){since=0; val en=sum/n; val lu=-.691+10*log10(en.coerceAtLeast(1e-20)); if(lu>-70) blocks.add(en)} }
    fun finish():Double{ if(blocks.isEmpty()) return Double.NEGATIVE_INFINITY; var mean=blocks.average(); val ung=-.691+10*log10(mean); val gate=ung-10
        val gated=blocks.filter{-.691+10*log10(it.coerceAtLeast(1e-20))>=gate}; if(gated.isNotEmpty()) mean=gated.average(); return -.691+10*log10(mean.coerceAtLeast(1e-20)) }
}

private class TruePeakMeter { private val l=DoubleArray(4); private val r=DoubleArray(4); private var count=0; private var peak=0.0
    fun add(a:Double,b:Double){peak=maxOf(peak,abs(a),abs(b)); if(count<4){l[count]=a;r[count]=b;count++;if(count<4)return}else{l[0]=l[1];l[1]=l[2];l[2]=l[3];l[3]=a;r[0]=r[1];r[1]=r[2];r[2]=r[3];r[3]=b}; for(t in doubleArrayOf(.125,.25,.375,.5,.625,.75,.875)) peak=maxOf(peak,abs(cubic(l,t)),abs(cubic(r,t)))}
    private fun cubic(y:DoubleArray,t:Double):Double{val a0=-.5*y[0]+1.5*y[1]-1.5*y[2]+.5*y[3];val a1=y[0]-2.5*y[1]+2*y[2]-.5*y[3];val a2=-.5*y[0]+.5*y[2];return ((a0*t+a1)*t+a2)*t+y[1]}
    fun finish()=if(peak>0)20*log10(peak) else Double.NEGATIVE_INFINITY }

private class Biquad { enum class Type{PEAK,LOW_SHELF,HIGH_SHELF}; private var b0=1.0;private var b1=0.0;private var b2=0.0;private var a1=0.0;private var a2=0.0;private var x1=0.0;private var x2=0.0;private var y1=0.0;private var y2=0.0
    fun process(x:Double):Double{val y=b0*x+b1*x1+b2*x2-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;return y}
    fun configure(type:Type,fs:Double,f0:Double,q:Double,gain:Double){val w=2*PI*f0.coerceIn(10.0,fs*.45)/fs;val c=cos(w);val s=sin(w);val alpha=s/(2*q.coerceAtLeast(.1));val A=10.0.pow(gain/40);var nb0:Double;var nb1:Double;var nb2:Double;var na0:Double;var na1:Double;var na2:Double
        when(type){Type.PEAK->{nb0=1+alpha*A;nb1=-2*c;nb2=1-alpha*A;na0=1+alpha/A;na1=-2*c;na2=1-alpha/A};Type.LOW_SHELF->{val beta=sqrt(A)/q.coerceAtLeast(.1);nb0=A*((A+1)-(A-1)*c+beta*s);nb1=2*A*((A-1)-(A+1)*c);nb2=A*((A+1)-(A-1)*c-beta*s);na0=(A+1)+(A-1)*c+beta*s;na1=-2*((A-1)+(A+1)*c);na2=(A+1)+(A-1)*c-beta*s};Type.HIGH_SHELF->{val beta=sqrt(A)/q.coerceAtLeast(.1);nb0=A*((A+1)+(A-1)*c+beta*s);nb1=-2*A*((A-1)+(A+1)*c);nb2=A*((A+1)+(A-1)*c-beta*s);na0=(A+1)-(A-1)*c+beta*s;na1=2*((A-1)-(A+1)*c);na2=(A+1)-(A-1)*c-beta*s}}
        b0=nb0/na0;b1=nb1/na0;b2=nb2/na0;a1=na1/na0;a2=na2/na0 }
    fun configureHighPass(fs:Double,f0:Double,q:Double){val w=2*PI*f0/fs;val c=cos(w);val s=sin(w);val al=s/(2*q.coerceAtLeast(.1));val na0=1+al;b0=((1+c)/2)/na0;b1=(-(1+c))/na0;b2=((1+c)/2)/na0;a1=(-2*c)/na0;a2=(1-al)/na0}
}

private class Wav24Writer(file:File,private val rate:Int):AutoCloseable{private val raf=RandomAccessFile(file,"rw");private var frames=0L
    init{raf.setLength(0);raf.writeBytes("RIFF");i32(0);raf.writeBytes("WAVEfmt ");i32(16);i16(1);i16(2);i32(rate);i32(rate*6);i16(6);i16(24);raf.writeBytes("data");i32(0)}
    fun write(l:Double,r:Double){w24(l);w24(r);frames++}
    private fun w24(v:Double){var q=(v.coerceIn(-1.0,.999999)*8388607).roundToInt();if(q<0)q+=1 shl 24;raf.write(q and 255);raf.write((q shr 8) and 255);raf.write((q shr 16) and 255)}
    override fun close(){val bytes=frames*6;raf.seek(4);i32((36+bytes).toInt());raf.seek(40);i32(bytes.toInt());raf.close()}
    private fun i32(v:Int){raf.write(v and 255);raf.write((v ushr 8) and 255);raf.write((v ushr 16) and 255);raf.write((v ushr 24) and 255)};private fun i16(v:Int){raf.write(v and 255);raf.write((v ushr 8) and 255)} }
