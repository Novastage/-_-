package com.novastage.novaredline

import java.util.concurrent.atomic.AtomicReference

data class NovaDspParams(
    val eqDb: List<Float> = List(7) { 0f },
    val lowDb: Float = 0f,
    val vocalDb: Float = 0f,
    val airDb: Float = 0f,
    val deHarshPercent: Float = 0f,
    val widthPercent: Float = 100f,
    val dynamicEqPercent: Float = 0f,
    val gluePercent: Float = 0f,
    val bypass: Boolean = false,
    val revision: Long = 0L
)

data class NovaLiveMeter(
    val bass: Float = 0f,
    val full: Float = 0f
)

class NovaDspController {
    private val ref = AtomicReference(NovaDspParams())
    private val meterRef = AtomicReference(NovaLiveMeter())

    fun snapshot(): NovaDspParams = ref.get()
    fun meterSnapshot(): NovaLiveMeter = meterRef.get()

    fun updateMeter(bass: Float, full: Float) {
        meterRef.set(
            NovaLiveMeter(
                bass = bass.coerceIn(0f, 1f),
                full = full.coerceIn(0f, 1f)
            )
        )
    }

    private fun mutate(block: (NovaDspParams) -> NovaDspParams) {
        while (true) {
            val old = ref.get()
            val next = block(old).copy(revision = old.revision + 1)
            if (ref.compareAndSet(old, next)) return
        }
    }

    fun setEq(index: Int, db: Float) = mutate { p ->
        val list = p.eqDb.toMutableList()
        if (index in list.indices) list[index] = db.coerceIn(-12f, 12f)
        p.copy(eqDb = list)
    }

    fun setAllEq(values: List<Float>) = mutate { p ->
        p.copy(eqDb = List(7) { i -> (values.getOrNull(i) ?: 0f).coerceIn(-12f, 12f) })
    }

    fun setLow(db: Float) = mutate { it.copy(lowDb = db.coerceIn(-6f, 6f)) }
    fun setVocal(db: Float) = mutate { it.copy(vocalDb = db.coerceIn(-6f, 6f)) }
    fun setAir(db: Float) = mutate { it.copy(airDb = db.coerceIn(-6f, 6f)) }
    fun setDeHarsh(value: Float) = mutate { it.copy(deHarshPercent = value.coerceIn(0f, 100f)) }
    fun setWidth(value: Float) = mutate { it.copy(widthPercent = value.coerceIn(60f, 150f)) }
    fun setDynamicEq(value: Float) = mutate { it.copy(dynamicEqPercent = value.coerceIn(0f, 100f)) }
    fun setGlue(value: Float) = mutate { it.copy(gluePercent = value.coerceIn(0f, 100f)) }
    fun setBypass(value: Boolean) = mutate { it.copy(bypass = value) }

    fun reset() = mutate {
        NovaDspParams(revision = it.revision)
    }

    fun applyPreset(
        eq: List<Float>,
        deHarsh: Float,
        width: Float,
        low: Float = 0f,
        vocal: Float = 0f,
        air: Float = 0f
    ) = mutate {
        it.copy(
            eqDb = List(7) { i -> (eq.getOrNull(i) ?: 0f).coerceIn(-12f, 12f) },
            deHarshPercent = deHarsh.coerceIn(0f, 100f),
            widthPercent = width.coerceIn(60f, 150f),
            lowDb = low.coerceIn(-6f, 6f),
            vocalDb = vocal.coerceIn(-6f, 6f),
            airDb = air.coerceIn(-6f, 6f),
            bypass = false
        )
    }
}
