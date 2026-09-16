package com.novastage.novaredline

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.UUID

data class NovaStemResult(val vocals: File, val mr: File)

class NovaStemClient(private val context: Context) {
    private val base: String get() = BuildConfig.NOVA_STEM_API_BASE_URL.trimEnd('/')

    suspend fun separate(
        uri: Uri,
        displayName: String,
        progress: (Float, String) -> Unit = { _, _ -> }
    ): NovaStemResult = withContext(Dispatchers.IO) {
        require(base.isNotBlank()) { "STEM API URL is not configured." }
        val meta = sourceMeta(uri, displayName)
        require(meta.size in 1..MAX_BYTES) { "STEM 파일은 최대 80MB까지 사용할 수 있습니다." }
        val pathname = buildPath(meta.name)
        progress(.02f, "UPLOAD 준비")

        val presign = postJson(
            "$base/api/redline/stem-upload",
            JSONObject().put("action", "presign").put("pathname", pathname).put("size", meta.size).put("contentType", meta.contentType)
        )
        val uploadUrl = presign.getString("uploadUrl")
        upload(uri, uploadUrl, meta.size, meta.contentType) { p -> progress(.03f + p * .42f, "음원 업로드 ${(p * 100).toInt()}%") }

        progress(.47f, "VOCAL / MR 분리 시작")
        val started = postJson("$base/api/redline/stem", JSONObject().put("audioPath", pathname))
        val id = started.getString("id")
        val deadline = System.currentTimeMillis() + 12 * 60 * 1000L
        var resultJson: JSONObject? = null
        var pulse = 0

        while (System.currentTimeMillis() < deadline) {
            delay(2200)
            val job = getJson("$base/api/redline/stem?id=${URLEncoder.encode(id, "UTF-8")}")
            when (job.optString("status")) {
                "succeeded" -> { resultJson = job; break }
                "failed" -> error(job.optString("error", "STEM 분리에 실패했습니다."))
                "canceled" -> error("STEM 작업이 취소되었습니다.")
                else -> { pulse++; progress(.48f + (pulse.coerceAtMost(35) / 35f) * .32f, "AI 분리 처리 중") }
            }
        }

        val output = (resultJson ?: error("STEM 처리 시간이 초과되었습니다.")).optJSONObject("output") ?: error("STEM 결과가 없습니다.")
        val vocalUrl = output.optString("vocals").takeIf { it.startsWith("http") } ?: error("VOCAL 결과 URL이 없습니다.")
        val mrUrl = output.optString("mr").ifBlank { output.optString("no_vocals") }.takeIf { it.startsWith("http") } ?: error("MR 결과 URL이 없습니다.")
        val dir = File(context.cacheDir, "stems").apply { mkdirs() }
        val stamp = System.currentTimeMillis()
        val vocals = File(dir, "Vocal_${stamp}_NOVA_REDLINE.wav")
        val mr = File(dir, "MR_${stamp}_NOVA_REDLINE.wav")
        progress(.82f, "VOCAL 결과 받는 중")
        download(vocalUrl, vocals) { p -> progress(.82f + p * .08f, "VOCAL 다운로드 ${(p * 100).toInt()}%") }
        progress(.91f, "MR 결과 받는 중")
        download(mrUrl, mr) { p -> progress(.91f + p * .08f, "MR 다운로드 ${(p * 100).toInt()}%") }
        progress(1f, "VOCAL / MR 분리 완료")
        NovaStemResult(vocals, mr)
    }

    private data class SourceMeta(val name: String, val size: Long, val contentType: String)

    private fun sourceMeta(uri: Uri, fallbackName: String): SourceMeta {
        var name = fallbackName.ifBlank { "source.wav" }; var size = -1L
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
            if (c.moveToFirst()) {
                val ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME); val si = c.getColumnIndex(OpenableColumns.SIZE)
                if (ni >= 0) name = c.getString(ni) ?: name
                if (si >= 0 && !c.isNull(si)) size = c.getLong(si)
            }
        }
        if (size <= 0) size = context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: -1L
        return SourceMeta(name, size, context.contentResolver.getType(uri) ?: "application/octet-stream")
    }

    private fun buildPath(name: String): String {
        val ext = name.substringAfterLast('.', "wav").lowercase().replace(Regex("[^a-z0-9]"), "").take(6).ifBlank { "wav" }
        return "redline/stem-input/android-${System.currentTimeMillis()}-${UUID.randomUUID()}.$ext"
    }

    private fun upload(uri: Uri, url: String, size: Long, contentType: String, progress: (Float) -> Unit) {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "PUT"; connectTimeout = 30_000; readTimeout = 90_000; doOutput = true
            setRequestProperty("Content-Type", contentType); if (size > 0) setFixedLengthStreamingMode(size)
        }
        var sent = 0L
        context.contentResolver.openInputStream(uri)?.use { raw ->
            BufferedInputStream(raw, BUFFER).use { input ->
                BufferedOutputStream(conn.outputStream, BUFFER).use { output ->
                    val buf = ByteArray(BUFFER)
                    while (true) {
                        val n = input.read(buf); if (n <= 0) break
                        output.write(buf, 0, n); sent += n
                        if (size > 0) progress((sent.toDouble() / size).coerceIn(0.0, 1.0).toFloat())
                    }
                    output.flush()
                }
            }
        } ?: error("선택한 음원을 열 수 없습니다.")
        val code = conn.responseCode
        if (code !in 200..299) {
            val text = conn.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty(); conn.disconnect()
            error("STEM 업로드 실패 ($code) ${text.take(180)}")
        }
        conn.inputStream?.close(); conn.disconnect(); progress(1f)
    }

    private fun download(url: String, file: File, progress: (Float) -> Unit) {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply { connectTimeout = 30_000; readTimeout = 120_000; requestMethod = "GET" }
        val code = conn.responseCode
        if (code !in 200..299) { conn.disconnect(); error("STEM 결과 다운로드 실패 ($code)") }
        val total = conn.contentLengthLong; var got = 0L
        BufferedInputStream(conn.inputStream, BUFFER).use { input ->
            BufferedOutputStream(FileOutputStream(file), BUFFER).use { output ->
                val buf = ByteArray(BUFFER)
                while (true) { val n = input.read(buf); if (n <= 0) break; output.write(buf, 0, n); got += n; if (total > 0) progress((got.toDouble() / total).toFloat()) }
            }
        }
        conn.disconnect(); progress(1f)
    }

    private fun postJson(url: String, body: JSONObject) = requestJson(url, "POST", body)
    private fun getJson(url: String) = requestJson(url, "GET", null)

    private fun requestJson(url: String, method: String, body: JSONObject?): JSONObject {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method; connectTimeout = 20_000; readTimeout = 60_000; setRequestProperty("Accept", "application/json")
            if (body != null) { doOutput = true; setRequestProperty("Content-Type", "application/json") }
        }
        if (body != null) conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
        val code = conn.responseCode
        val text = (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
        conn.disconnect()
        val json = if (text.isBlank()) JSONObject() else JSONObject(text)
        if (code !in 200..299) error(json.optString("error", "HTTP $code"))
        return json
    }

    companion object { private const val BUFFER = 64 * 1024; private const val MAX_BYTES = 80L * 1024L * 1024L }
}
