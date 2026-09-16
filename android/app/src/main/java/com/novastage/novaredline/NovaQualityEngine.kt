package com.novastage.novaredline

import java.io.File
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.cos

data class NovaLoudnessSnapshot(
    val integrated: Double,
    val shortTerm: Double,
    val momentary: Double
)

data class NovaLimiterStats(
    val maxGainReductionDb: Double,
    val averageGainReductionDb: Double,
    val finalPeakDbfs: Double
)

class NovaSincResampler(
    private val source: StereoPcmSource,
    private val sourceRate: Int,
    private val targetRate: Int,
    private val taps: Int = 32
) : AutoCloseable {
    private val half = taps / 2
    private val ratio = sourceRate.toDouble() / targetRate.toDouble()
    private var outIndex = 0L

    val outputFrames: Long = maxOf(
        1L,
        kotlin.math.round(source.totalFrames * targetRate.toDouble() / sourceRate.toDouble()).toLong()
    )

    fun next(): NovaStereoSample? {
        if (outIndex >= outputFrames) return null
        val sourcePos = outIndex * ratio
        val center = floor(sourcePos).toLong()
        val frac = sourcePos - center
        var left = 0.0
        var right = 0.0
        var norm = 0.0
        val cutoff = min(1.0, targetRate.toDouble() / sourceRate.toDouble()) * 0.94

        for (k in -half + 1 .. half) {
            val sample = source.sampleAt(center + k)
            val x = (k - frac) * cutoff
            val sinc = if (abs(x) < 1e-12) 1.0 else sin(PI * x) / (PI * x)
            val n = (k + half - 1).toDouble() / (taps - 1).toDouble()
            val window = 0.42 - 0.5 * cos(2.0 * PI * n) + 0.08 * cos(4.0 * PI * n)
            val w = sinc * window * cutoff
            left += sample.l * w
            right += sample.r * w
            norm += w
        }
        outIndex++
        if (abs(norm) > 1e-12) {
            left /= norm
            right /= norm
        }
        return NovaStereoSample(left, right)
    }

    override fun close() { source.close() }
}

data class NovaStereoSample(val l: Double, val r: Double)

class StereoPcmSource(
    file: File,
    val totalFrames: Long
) : AutoCloseable {
    private val raf = java.io.RandomAccessFile(file, "r")
    private val cacheSize = 8192
    private var cacheStart = Long.MIN_VALUE
    private var cacheFrames = 0
    private val cacheL = DoubleArray(cacheSize)
    private val cacheR = DoubleArray(cacheSize)

    fun sampleAt(frame: Long): NovaStereoSample {
        if (frame < 0 || frame >= totalFrames) return NovaStereoSample(0.0, 0.0)
        if (frame < cacheStart || frame >= cacheStart + cacheFrames) fillCache(frame)
        val i = (frame - cacheStart).toInt()
        return NovaStereoSample(cacheL[i], cacheR[i])
    }

    private fun fillCache(startFrame: Long) {
        cacheStart = startFrame.coerceIn(0L, max(0L, totalFrames - 1))
        raf.seek(cacheStart * 4L)
        cacheFrames = min(cacheSize.toLong(), totalFrames - cacheStart).toInt()
        for (i in 0 until cacheFrames) {
            val b0 = raf.read(); val b1 = raf.read(); val b2 = raf.read(); val b3 = raf.read()
            if (b3 < 0) { cacheFrames = i; break }
            val l = ((b1 shl 8) or b0).toShort().toInt()
            val r = ((b3 shl 8) or b2).toShort().toInt()
            cacheL[i] = l / 32768.0
            cacheR[i] = r / 32768.0
        }
    }

    override fun close() { raf.close() }
}

class NovaLookAheadLimiter(
    private val sampleRate: Int,
    private val ceilingDb: Double,
    lookAheadMs: Double = 5.0,
    releaseMs: Double = 90.0
) {
    private val ceiling = 10.0.pow(ceilingDb / 20.0)
    private val lookahead = max(1, (sampleRate * lookAheadMs / 1000.0).toInt())
    private val ringL = DoubleArray(lookahead + 1)
    private val ringR = DoubleArray(lookahead + 1)
    private var write = 0
    private var filled = 0
    private var currentGain = 1.0
    private val releaseCoeff = kotlin.math.exp(-1.0 / (sampleRate * releaseMs / 1000.0))
    private var maxGr = 0.0
    private var sumGr = 0.0
    private var samples = 0L
    private var finalPeak = 0.0

    fun process(l: Double, r: Double): NovaStereoSample {
        ringL[write] = l; ringR[write] = r
        var futurePeak = 0.0
        for (i in ringL.indices) futurePeak = maxOf(futurePeak, abs(ringL[i]), abs(ringR[i]))
        val targetGain = if (futurePeak > ceiling && futurePeak > 0.0) ceiling / futurePeak else 1.0
        currentGain = if (targetGain < currentGain) targetGain else 1.0 - (1.0 - currentGain) * releaseCoeff
        val read = (write + 1) % ringL.size
        val outL = if (filled >= ringL.size - 1) ringL[read] * currentGain else 0.0
        val outR = if (filled >= ringL.size - 1) ringR[read] * currentGain else 0.0
        write = read
        if (filled < ringL.size) filled++
        val gr = -20.0 * kotlin.math.log10(currentGain.coerceAtLeast(1e-12))
        maxGr = max(maxGr, gr); sumGr += gr; samples++
        finalPeak = maxOf(finalPeak, abs(outL), abs(outR))
        return NovaStereoSample(outL, outR)
    }

    fun stats(): NovaLimiterStats {
        val peakDb = if (finalPeak > 0.0) 20.0 * kotlin.math.log10(finalPeak) else Double.NEGATIVE_INFINITY
        return NovaLimiterStats(maxGr, if (samples > 0) sumGr / samples else 0.0, peakDb)
    }
}

class NovaRealtimeLoudnessWindows(private val sampleRate: Int) {
    private val momentaryN = max(1, (sampleRate * 0.400).toInt())
    private val shortN = max(1, (sampleRate * 3.000).toInt())
    private val momentary = DoubleArray(momentaryN)
    private val short = DoubleArray(shortN)
    private var mi = 0; private var si = 0; private var mf = 0; private var sf = 0
    private var mSum = 0.0; private var sSum = 0.0

    fun add(l: Double, r: Double) {
        val e = l*l + r*r
        if (mf < momentaryN) mf++ else mSum -= momentary[mi]
        momentary[mi] = e; mSum += e; mi = (mi + 1) % momentaryN
        if (sf < shortN) sf++ else sSum -= short[si]
        short[si] = e; sSum += e; si = (si + 1) % shortN
    }

    fun momentaryLufs(): Double = if (mf == 0) Double.NEGATIVE_INFINITY else -0.691 + 10.0 * kotlin.math.log10((mSum / mf).coerceAtLeast(1e-20))
    fun shortTermLufs(): Double = if (sf == 0) Double.NEGATIVE_INFINITY else -0.691 + 10.0 * kotlin.math.log10((sSum / sf).coerceAtLeast(1e-20))
}

object NovaLoudnessMaximizer {
    fun computeGainDb(currentLufs: Double, targetLufs: Double, maxBoostDb: Double): Double {
        if (!currentLufs.isFinite()) return 0.0
        return (targetLufs - currentLufs).coerceIn(-24.0, maxBoostDb)
    }
}

class NovaTruePeakLimiter8x(
    private val sampleRate: Int,
    private val ceilingDb: Double,
    lookAheadMs: Double = 5.0,
    releaseMs: Double = 90.0
) {
    private val ceiling = 10.0.pow(ceilingDb / 20.0)
    private val lookahead = max(8, (sampleRate * lookAheadMs / 1000.0).toInt())
    private val size = lookahead + 8
    val latencyFrames: Int = size - 1
    private val ringL = DoubleArray(size); private val ringR = DoubleArray(size); private val ringPeak = DoubleArray(size)
    private val hL = DoubleArray(4); private val hR = DoubleArray(4)
    private var history = 0; private var write = 0; private var filled = 0; private var currentGain = 1.0
    private val releaseCoeff = kotlin.math.exp(-1.0 / (sampleRate * releaseMs / 1000.0))
    private var maxGr = 0.0; private var sumGr = 0.0; private var processed = 0L; private var finalPeak = 0.0

    fun process(l: Double, r: Double): NovaStereoSample {
        pushHistory(hL, l); pushHistory(hR, r); if (history < 4) history++
        var tp = max(abs(l), abs(r))
        if (history >= 4) {
            for (t in doubleArrayOf(.125, .25, .375, .50, .625, .75, .875)) {
                tp = maxOf(tp, abs(cubic(hL[0], hL[1], hL[2], hL[3], t)), abs(cubic(hR[0], hR[1], hR[2], hR[3], t)))
            }
        }
        ringL[write] = l; ringR[write] = r; ringPeak[write] = tp
        var futurePeak = 0.0
        for (i in ringPeak.indices) futurePeak = max(futurePeak, ringPeak[i])
        val targetGain = if (futurePeak > ceiling && futurePeak > 0.0) ceiling / futurePeak else 1.0
        currentGain = if (targetGain < currentGain) targetGain else 1.0 - (1.0 - currentGain) * releaseCoeff
        val read = (write + 1) % size
        val outL = if (filled >= size - 1) ringL[read] * currentGain else 0.0
        val outR = if (filled >= size - 1) ringR[read] * currentGain else 0.0
        write = read; if (filled < size) filled++
        val gr = -20.0 * kotlin.math.log10(currentGain.coerceAtLeast(1e-12))
        maxGr = max(maxGr, gr); sumGr += gr; processed++; finalPeak = maxOf(finalPeak, abs(outL), abs(outR))
        return NovaStereoSample(outL, outR)
    }

    fun stats() = NovaLimiterStats(maxGr, if (processed > 0) sumGr / processed else 0.0, if (finalPeak > 0.0) 20.0 * kotlin.math.log10(finalPeak) else Double.NEGATIVE_INFINITY)
    private fun pushHistory(h: DoubleArray, v: Double) { h[0] = h[1]; h[1] = h[2]; h[2] = h[3]; h[3] = v }
    private fun cubic(y0: Double, y1: Double, y2: Double, y3: Double, t: Double): Double {
        val a0 = -.5*y0 + 1.5*y1 - 1.5*y2 + .5*y3
        val a1 = y0 - 2.5*y1 + 2.0*y2 - .5*y3
        val a2 = -.5*y0 + .5*y2
        return ((a0*t + a1)*t + a2)*t + y1
    }
}

class Nova3ZoneDynamics(
    private val sampleRate: Int,
    dynamicEqPercent: Float = 35f,
    gluePercent: Float = 30f
) {
    private var dynamic = (dynamicEqPercent / 100f).coerceIn(0f, 1f)
    private var glue = (gluePercent / 100f).coerceIn(0f, 1f)
    private val lowL = OnePoleLowPass(sampleRate, 160.0); private val lowR = OnePoleLowPass(sampleRate, 160.0)
    private val highLpL = OnePoleLowPass(sampleRate, 4200.0); private val highLpR = OnePoleLowPass(sampleRate, 4200.0)
    private var envLow = 0.0; private var envMid = 0.0; private var envHigh = 0.0
    private val attack = kotlin.math.exp(-1.0 / (sampleRate * .012))
    private val release = kotlin.math.exp(-1.0 / (sampleRate * .120))

    fun setAmounts(dynamicEqPercent: Float, gluePercent: Float) {
        dynamic = (dynamicEqPercent / 100f).coerceIn(0f, 1f); glue = (gluePercent / 100f).coerceIn(0f, 1f)
    }
    fun reset() { lowL.reset(); lowR.reset(); highLpL.reset(); highLpR.reset(); envLow = 0.0; envMid = 0.0; envHigh = 0.0 }

    fun process(l: Double, r: Double): NovaStereoSample {
        val loL = lowL.process(l); val loR = lowR.process(r)
        val lp4L = highLpL.process(l); val lp4R = highLpR.process(r)
        val hiL = l - lp4L; val hiR = r - lp4R
        val midL = l - loL - hiL; val midR = r - loR - hiR
        envLow = follow(envLow, max(abs(loL), abs(loR)))
        envMid = follow(envMid, max(abs(midL), abs(midR)))
        envHigh = follow(envHigh, max(abs(hiL), abs(hiR)))
        val lowGain = compressorGain(envLow, -15.0, 1.0 + glue * 1.7)
        var midGain = compressorGain(envMid, -13.0, 1.0 + glue * 1.25)
        var highGain = compressorGain(envHigh, -17.0, 1.0 + glue * 1.45)
        val midDynCutDb = min(2.4, excessDb(envMid, -11.5) * .22) * dynamic
        val highDynCutDb = min(2.8, excessDb(envHigh, -15.0) * .28) * dynamic
        midGain *= 10.0.pow(-midDynCutDb / 20.0); highGain *= 10.0.pow(-highDynCutDb / 20.0)
        return NovaStereoSample(loL * lowGain + midL * midGain + hiL * highGain, loR * lowGain + midR * midGain + hiR * highGain)
    }

    private fun follow(old: Double, x: Double): Double { val c = if (x > old) attack else release; return x + c * (old - x) }
    private fun compressorGain(env: Double, thresholdDb: Double, ratio: Double): Double {
        if (env <= 1e-12 || ratio <= 1.0001) return 1.0
        val levelDb = 20.0 * kotlin.math.log10(env)
        if (levelDb <= thresholdDb) return 1.0
        val outDb = thresholdDb + (levelDb - thresholdDb) / ratio
        return 10.0.pow((outDb - levelDb) / 20.0)
    }
    private fun excessDb(env: Double, thresholdDb: Double): Double = if (env <= 1e-12) 0.0 else max(0.0, 20.0 * kotlin.math.log10(env) - thresholdDb)

    private class OnePoleLowPass(sampleRate: Int, cutoff: Double) {
        private val a = 1.0 - kotlin.math.exp(-2.0 * PI * cutoff / sampleRate)
        private var z = 0.0
        fun process(x: Double): Double { z += a * (x - z); return z }
        fun reset() { z = 0.0 }
    }
}
