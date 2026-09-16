package com.novastage.novaredline

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.util.Locale

private val Bg = Color(0xFF08090B)
private val Panel = Color(0xFF131518)
private val Line = Color(0xFF30343A)
private val Red = Color(0xFFFF3048)
private val Red2 = Color(0xFFB40825)
private val Text = Color(0xFFF5F5F6)
private val Muted = Color(0xFF959BA4)
private val Green = Color(0xFF52D88B)
private val Orange = Color(0xFFFFA05E)
private enum class Mode { MASTER, STEM }

@Composable
fun NovaRedLineApp() {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Red,
            background = Bg,
            surface = Panel,
            onPrimary = Color.White,
            onBackground = Text,
            onSurface = Text
        )
    ) {
        var mode by remember { mutableStateOf(Mode.MASTER) }
        Surface(Modifier.fillMaxSize(), color = Bg) {
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Row {
                            Text("NOVA ", fontWeight = FontWeight.Black, fontSize = 22.sp)
                            Text("RED LINE", color = Red, fontWeight = FontWeight.Black, fontSize = 22.sp)
                        }
                        Text("MOBILE · SIMPLE CORE V1.0", color = Muted, fontSize = 9.sp)
                    }
                    Text("2 FUNCTIONS", color = Green, fontWeight = FontWeight.Black, fontSize = 9.sp)
                }
                Row(
                    Modifier.fillMaxWidth().background(Color(0xFF0D0F11), RoundedCornerShape(12.dp)).padding(5.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Tab("AUTO MASTER", mode == Mode.MASTER, Modifier.weight(1f)) { mode = Mode.MASTER }
                    Tab("VOCAL · MR", mode == Mode.STEM, Modifier.weight(1f)) { mode = Mode.STEM }
                }
                if (mode == Mode.MASTER) MasterScreen() else StemScreen()
                Text(
                    "NOVA RED LINE · ONE-TAP MASTERING + VOCAL/MR",
                    color = Color(0xFF646B73),
                    fontSize = 8.sp,
                    modifier = Modifier.padding(bottom = 20.dp)
                )
            }
        }
    }
}

@Composable
private fun Tab(t: String, on: Boolean, m: Modifier, click: () -> Unit) {
    Button(
        onClick = click,
        modifier = m.height(46.dp),
        colors = ButtonDefaults.buttonColors(containerColor = if (on) Red2 else Color.Transparent)
    ) {
        Text(t, fontWeight = FontWeight.Black, fontSize = 10.sp)
    }
}

@Composable
private fun MasterScreen() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val state by NovaRenderBus.state.collectAsState()
    var uri by remember { mutableStateOf<Uri?>(null) }
    var name by remember { mutableStateOf("파일을 선택하세요") }
    var result by remember { mutableStateOf<NovaMasterResult?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val original = rememberPlayer(ctx)
    val master = rememberPlayer(ctx)
    var activeMaster by remember { mutableStateOf(false) }
    var saveFile by remember { mutableStateOf<File?>(null) }

    val pick = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { u ->
        if (u != null) {
            persist(ctx, u)
            uri = u
            name = fileName(ctx, u)
            result = null
            error = null
            original.setMediaItem(MediaItem.fromUri(u))
            original.prepare()
            master.clearMediaItems()
        }
    }
    val save = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("audio/wav")) { u ->
        val f = saveFile
        if (u != null && f != null) scope.launch {
            try { copy(ctx, f, u) } catch (t: Throwable) { error = t.message }
        }
    }

    DisposableEffect(Unit) { onDispose { original.release(); master.release() } }
    LaunchedEffect(state) {
        when (val s = state) {
            is NovaRenderState.Completed -> {
                result = s.result
                master.setMediaItem(MediaItem.fromUri(Uri.fromFile(s.result.file)))
                master.prepare()
                activeMaster = true
            }
            is NovaRenderState.Failed -> error = s.message
            else -> Unit
        }
    }

    val busy = state is NovaRenderState.Running
    val prog = (state as? NovaRenderState.Running)?.progress ?: if (result != null) 1f else 0f

    CardBox("AUTO MASTER") {
        Text("파일 선택 → ONE TAP → A/B 확인 → WAV 저장. 수동 EQ나 장르 선택은 없습니다.", color = Muted, fontSize = 11.sp)
        FilePick(name) { pick.launch(arrayOf("audio/*")) }
        Button(
            onClick = {
                uri?.let {
                    result = null
                    error = null
                    master.clearMediaItems()
                    NovaRenderService.startAuto(ctx, it)
                }
            },
            enabled = uri != null && !busy,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Red)
        ) {
            Text("AUTO MASTER · ONE TAP", fontWeight = FontWeight.Black)
        }
        if (busy || prog > 0) {
            LinearProgressIndicator(progress = { prog.coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth(), color = Red)
            Text((state as? NovaRenderState.Running)?.status ?: "MASTER COMPLETE", color = if (busy) Orange else Green, fontSize = 9.sp)
        }
        error?.let { Err(it) }
    }

    result?.let { r ->
        CardBox("ORIGINAL / MASTER A·B") {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { switch(master, original); activeMaster = false }, modifier = Modifier.weight(1f)) { Text("A · ORIGINAL") }
                OutlinedButton(onClick = { switch(original, master); activeMaster = true }, modifier = Modifier.weight(1f)) { Text("B · MASTER") }
            }
            PlayerControl(if (activeMaster) master else original)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Metric("SOURCE", "${r.sourceStats.lufsI.f1()} LUFS", Modifier.weight(1f))
                Metric("FINAL", "${r.finalStats.lufsI.f1()} LUFS", Modifier.weight(1f))
                Metric("TRUE PEAK", "${r.finalStats.truePeakDbtp.f1()} dBTP", Modifier.weight(1f))
            }
            Text("48 kHz · Stereo · PCM 24-bit · 8× True-Peak Safety", color = Green, fontSize = 9.sp)
            Button(
                onClick = { saveFile = r.file; save.launch(masterName(name)) },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Red2)
            ) { Text("MASTER WAV 저장") }
        }
    }
}

@Composable
private fun StemScreen() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val client = remember { NovaStemClient(ctx) }
    var uri by remember { mutableStateOf<Uri?>(null) }
    var name by remember { mutableStateOf("파일을 선택하세요") }
    var busy by remember { mutableStateOf(false) }
    var prog by remember { mutableFloatStateOf(0f) }
    var status by remember { mutableStateOf("READY") }
    var error by remember { mutableStateOf<String?>(null) }
    var result by remember { mutableStateOf<NovaStemResult?>(null) }
    var pending by remember { mutableStateOf<File?>(null) }
    var pendingName by remember { mutableStateOf("NOVA_RED_LINE.wav") }
    val vocal = rememberPlayer(ctx)
    val mr = rememberPlayer(ctx)

    val pick = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { u ->
        if (u != null) {
            persist(ctx, u)
            uri = u
            name = fileName(ctx, u)
            result = null
            error = null
            prog = 0f
            vocal.clearMediaItems()
            mr.clearMediaItems()
        }
    }
    val save = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("audio/wav")) { u ->
        val f = pending
        if (u != null && f != null) scope.launch {
            try { copy(ctx, f, u) } catch (t: Throwable) { error = t.message }
        }
    }

    DisposableEffect(Unit) { onDispose { vocal.release(); mr.release() } }

    CardBox("VOCAL / MR SEPARATION") {
        Text("복잡한 Stem 메뉴 없이 VOCAL과 MR 두 파일만 분리합니다.", color = Muted, fontSize = 11.sp)
        FilePick(name) { pick.launch(arrayOf("audio/*")) }
        Button(
            onClick = {
                val u = uri ?: return@Button
                scope.launch {
                    busy = true
                    error = null
                    result = null
                    try {
                        val r = client.separate(u, name) { p, s -> prog = p; status = s }
                        result = r
                        vocal.setMediaItem(MediaItem.fromUri(Uri.fromFile(r.vocals))); vocal.prepare()
                        mr.setMediaItem(MediaItem.fromUri(Uri.fromFile(r.mr))); mr.prepare()
                    } catch (t: Throwable) {
                        error = t.message
                        status = "STEM ERROR"
                    } finally {
                        busy = false
                    }
                }
            },
            enabled = uri != null && !busy,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Red)
        ) { Text("VOCAL / MR 분리 시작", fontWeight = FontWeight.Black) }
        if (busy || prog > 0) {
            LinearProgressIndicator(progress = { prog.coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth(), color = Red)
            Text(status, color = if (busy) Orange else Green, fontSize = 9.sp)
        }
        error?.let { Err(it) }
    }

    result?.let { r ->
        CardBox("VOCAL RESULT") {
            PlayerControl(vocal)
            Button(
                onClick = { pending = r.vocals; pendingName = stemName("Vocal", name); save.launch(pendingName) },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Red2)
            ) { Text("VOCAL WAV 저장") }
        }
        CardBox("MR RESULT") {
            PlayerControl(mr)
            Button(
                onClick = { pending = r.mr; pendingName = stemName("MR", name); save.launch(pendingName) },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Red2)
            ) { Text("MR WAV 저장") }
        }
    }
}

@Composable
private fun CardBox(title: String, body: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier.fillMaxWidth().background(Panel, RoundedCornerShape(14.dp)).border(1.dp, Line, RoundedCornerShape(14.dp)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(title, fontWeight = FontWeight.Black, fontSize = 14.sp)
        body()
    }
}

@Composable
private fun FilePick(name: String, click: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(Color(0xFF0D0F11), RoundedCornerShape(10.dp)).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text("SOURCE", color = Muted, fontSize = 8.sp)
            Text(name, maxLines = 1, fontSize = 10.sp)
        }
        OutlinedButton(onClick = click) { Text("파일 선택", fontSize = 9.sp) }
    }
}

@Composable
private fun PlayerControl(p: ExoPlayer) {
    var playing by remember(p) { mutableStateOf(false) }
    DisposableEffect(p) {
        val l = object : Player.Listener {
            override fun onIsPlayingChanged(v: Boolean) { playing = v }
        }
        p.addListener(l)
        onDispose { p.removeListener(l) }
    }
    Button(
        onClick = { if (p.isPlaying) p.pause() else p.play() },
        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2B2E33))
    ) { Text(if (playing) "PAUSE" else "PLAY") }
}

@Composable
private fun Metric(k: String, v: String, m: Modifier) {
    Column(m.background(Color(0xFF0D0F11), RoundedCornerShape(8.dp)).padding(8.dp)) {
        Text(k, color = Muted, fontSize = 7.sp)
        Text(v, fontWeight = FontWeight.Black, fontSize = 9.sp)
    }
}

@Composable
private fun Err(s: String) {
    Text(s, color = Color(0xFFFF7D88), fontSize = 9.sp, modifier = Modifier.fillMaxWidth().background(Color(0xFF2B0D12), RoundedCornerShape(8.dp)).padding(10.dp))
}

@Composable private fun rememberPlayer(c: Context) = remember(c) { ExoPlayer.Builder(c).build() }
private fun switch(from: ExoPlayer, to: ExoPlayer) { val pos = from.currentPosition; val play = from.isPlaying; from.pause(); to.seekTo(pos); if (play) to.play() }
private fun persist(c: Context, u: Uri) { runCatching { c.contentResolver.takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION) } }
private fun fileName(c: Context, u: Uri): String { c.contentResolver.query(u, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { if (it.moveToFirst()) { val i = it.getColumnIndex(OpenableColumns.DISPLAY_NAME); if (i >= 0) return it.getString(i) } }; return u.lastPathSegment ?: "Audio" }
private suspend fun copy(c: Context, f: File, u: Uri) = withContext(Dispatchers.IO) { FileInputStream(f).use { i -> c.contentResolver.openOutputStream(u)?.use { o -> i.copyTo(o) } ?: error("저장 위치를 열 수 없습니다.") } }
private fun clean(s: String) = s.replace(Regex("[\\/:*?\"<>|]"), "_").trim().take(90).ifBlank { "Audio" }
private fun masterName(s: String) = "Mastered_${clean(s.substringBeforeLast('.'))}_NOVA_REDLINE_48k_24bit.wav"
private fun stemName(k: String, s: String) = "${k}_${clean(s.substringBeforeLast('.'))}_NOVA_REDLINE.wav"
private fun Double.f1() = if (isFinite()) String.format(Locale.US, "%.1f", this) else "—"
