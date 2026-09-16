package com.novastage.novaredline

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class NovaRenderService : Service() {

    companion object {
        private const val CHANNEL_ID = "nova_master_render"
        private const val NOTIFICATION_ID = 7007

        private const val ACTION_START = "com.novastage.novaredline.RENDER_START"
        private const val ACTION_CANCEL = "com.novastage.novaredline.RENDER_CANCEL"

        private const val EXTRA_URI = "source_uri"
        private const val EXTRA_TARGET = "target_lufs"
        private const val EXTRA_CEILING = "ceiling_dbtp"
        private const val EXTRA_EQ = "eq"
        private const val EXTRA_LOW = "low"
        private const val EXTRA_VOCAL = "vocal"
        private const val EXTRA_AIR = "air"
        private const val EXTRA_DEHARSH = "deharsh"
        private const val EXTRA_WIDTH = "width"
        private const val EXTRA_DYNAMIC = "dynamic"
        private const val EXTRA_GLUE = "glue"
        private const val EXTRA_BYPASS = "bypass"
        private const val EXTRA_AUTO = "auto_mode"

        fun start(
            context: android.content.Context,
            sourceUri: Uri,
            params: NovaDspParams,
            targetLufs: Double,
            ceilingDbtp: Double
        ) {
            val intent = Intent(context, NovaRenderService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_URI, sourceUri.toString())
                putExtra(EXTRA_TARGET, targetLufs)
                putExtra(EXTRA_CEILING, ceilingDbtp)
                putExtra(EXTRA_EQ, params.eqDb.toFloatArray())
                putExtra(EXTRA_LOW, params.lowDb)
                putExtra(EXTRA_VOCAL, params.vocalDb)
                putExtra(EXTRA_AIR, params.airDb)
                putExtra(EXTRA_DEHARSH, params.deHarshPercent)
                putExtra(EXTRA_WIDTH, params.widthPercent)
                putExtra(EXTRA_DYNAMIC, params.dynamicEqPercent)
                putExtra(EXTRA_GLUE, params.gluePercent)
                putExtra(EXTRA_BYPASS, params.bypass)
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun startAuto(
            context: android.content.Context,
            sourceUri: Uri
        ) {
            val intent = Intent(context, NovaRenderService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_URI, sourceUri.toString())
                putExtra(EXTRA_AUTO, true)
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun cancel(context: android.content.Context) {
            val intent = Intent(context, NovaRenderService::class.java).apply {
                action = ACTION_CANCEL
            }
            context.startService(intent)
        }
    }

    private val serviceJob = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.Default + serviceJob)
    private var renderJob: Job? = null
    private var engine: NovaOfflineMasterEngine? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
        engine = NovaOfflineMasterEngine(this)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_CANCEL -> cancelRender()
            ACTION_START -> startRender(intent)
        }
        return START_NOT_STICKY
    }

    private fun startRender(intent: Intent) {
        if (renderJob?.isActive == true) return

        val source = intent.getStringExtra(EXTRA_URI)?.let(Uri::parse) ?: run {
            stopSelfSafely()
            return
        }

        val autoMode = intent.getBooleanExtra(EXTRA_AUTO, false)
        val requestedTarget = intent.getDoubleExtra(EXTRA_TARGET, -11.0)
        val requestedCeiling = intent.getDoubleExtra(EXTRA_CEILING, -1.3)
        val eq = intent.getFloatArrayExtra(EXTRA_EQ)?.toList() ?: List(7) { 0f }

        val params = NovaDspParams(
            eqDb = List(7) { i -> eq.getOrNull(i) ?: 0f },
            lowDb = intent.getFloatExtra(EXTRA_LOW, 0f),
            vocalDb = intent.getFloatExtra(EXTRA_VOCAL, 0f),
            airDb = intent.getFloatExtra(EXTRA_AIR, 0f),
            deHarshPercent = intent.getFloatExtra(EXTRA_DEHARSH, 45f),
            widthPercent = intent.getFloatExtra(EXTRA_WIDTH, 100f),
            dynamicEqPercent = intent.getFloatExtra(EXTRA_DYNAMIC, 35f),
            gluePercent = intent.getFloatExtra(EXTRA_GLUE, 30f),
            bypass = intent.getBooleanExtra(EXTRA_BYPASS, false)
        )

        startForegroundNow("마스터링 준비 중", 0)

        renderJob = scope.launch {
            var prepared: NovaPreparedSource? = null
            try {
                NovaRenderBus.emit(NovaRenderState.Running(0f, "PREPARING"))

                prepared = engine!!.prepareSource(source) { p, s ->
                    val overall = p * .30f
                    NovaRenderBus.emit(NovaRenderState.Running(overall, s))
                    updateNotification(s, (overall * 100).toInt())
                }

                val autoProfile = if (autoMode) NovaAutoMasterProfile.choose(prepared.sourceStats) else null
                val renderParams = autoProfile?.params ?: params
                val target = autoProfile?.targetLufs ?: requestedTarget
                val ceiling = autoProfile?.ceilingDbtp ?: requestedCeiling

                if (autoProfile != null) {
                    NovaRenderBus.emit(
                        NovaRenderState.Running(.30f, "AUTO PROFILE · ${autoProfile.name}")
                    )
                    updateNotification("AUTO PROFILE · ${autoProfile.name}", 30)
                }

                val result = engine!!.renderMaster(
                    prepared = prepared,
                    params = renderParams,
                    targetLufs = target,
                    ceilingDbtp = ceiling
                ) { p, s ->
                    val overall = .30f + p * .70f
                    NovaRenderBus.emit(NovaRenderState.Running(overall, s))
                    updateNotification(s, (overall * 100).toInt())
                }

                persistLastResult(result)
                NovaRenderBus.emit(NovaRenderState.Completed(result))
                updateNotification("마스터링 완료", 100)
                stopForeground(STOP_FOREGROUND_DETACH)
                stopSelf()
            } catch (_: CancellationException) {
                NovaRenderBus.emit(NovaRenderState.Cancelled)
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            } catch (t: Throwable) {
                NovaRenderBus.emit(
                    NovaRenderState.Failed(t.message ?: t.toString())
                )
                updateNotification("마스터링 오류", 0)
                stopForeground(STOP_FOREGROUND_DETACH)
                stopSelf()
            } finally {
                engine?.cleanup(prepared)
            }
        }
    }

    private fun cancelRender() {
        renderJob?.cancel()
        renderJob = null
        NovaRenderBus.emit(NovaRenderState.Cancelled)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun startForegroundNow(text: String, progress: Int) {
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(text, progress),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING
        )
    }

    private fun updateNotification(text: String, progress: Int) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(
            NOTIFICATION_ID,
            buildNotification(text, progress)
        )
    }

    private fun buildNotification(text: String, progress: Int) =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setContentTitle("NOVA RED LINE")
            .setContentText(text)
            .setOnlyAlertOnce(true)
            .setOngoing(progress in 0..99)
            .setProgress(100, progress.coerceIn(0, 100), false)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "취소",
                PendingIntent.getService(
                    this,
                    10,
                    Intent(this, NovaRenderService::class.java).apply {
                        action = ACTION_CANCEL
                    },
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
            )
            .build()

    private fun createChannel() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "NOVA Master Rendering",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "백그라운드 오디오 마스터링 진행 상태"
            }
        )
    }

    private fun persistLastResult(result: NovaMasterResult) {
        getSharedPreferences("nova_last_master", MODE_PRIVATE)
            .edit()
            .putString("path", result.file.absolutePath)
            .putFloat("lufs", result.finalStats.lufsI.toFloat())
            .putFloat("tp", result.finalStats.truePeakDbtp.toFloat())
            .putLong("saved_at", System.currentTimeMillis())
            .apply()
    }

    override fun onTimeout(startId: Int, fgsType: Int) {
        renderJob?.cancel()
        NovaRenderBus.emit(
            NovaRenderState.Failed("Android mediaProcessing foreground-service timeout")
        )
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        renderJob?.cancel()
        scope.cancel()
        super.onDestroy()
    }

    private fun stopSelfSafely(): Int {
        stopSelf()
        return START_NOT_STICKY
    }
}
