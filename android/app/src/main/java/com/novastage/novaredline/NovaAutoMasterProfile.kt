package com.novastage.novaredline

data class NovaAutoProfile(
    val name: String,
    val params: NovaDspParams,
    val targetLufs: Double,
    val ceilingDbtp: Double
)

object NovaAutoMasterProfile {
    fun choose(stats: NovaAudioStats): NovaAutoProfile {
        val lufs = stats.lufsI
        val tp = stats.truePeakDbtp

        return when {
            (lufs.isFinite() && lufs >= -10.5) || (tp.isFinite() && tp >= -0.8) ->
                NovaAutoProfile(
                    name = "CLEAN DENSE",
                    params = NovaDspParams(
                        eqDb = listOf(0f, 0f, -0.35f, -0.10f, 0.20f, 0.10f, 0f),
                        deHarshPercent = 16f,
                        widthPercent = 101f,
                        dynamicEqPercent = 16f,
                        gluePercent = 10f
                    ),
                    targetLufs = -11.0,
                    ceilingDbtp = -1.3
                )

            lufs.isFinite() && lufs <= -16.0 ->
                NovaAutoProfile(
                    name = "CLEAN OPEN",
                    params = NovaDspParams(
                        eqDb = listOf(0.10f, 0.20f, -0.45f, -0.10f, 0.25f, 0.20f, 0.10f),
                        deHarshPercent = 20f,
                        widthPercent = 103f,
                        dynamicEqPercent = 28f,
                        gluePercent = 22f
                    ),
                    targetLufs = -11.0,
                    ceilingDbtp = -1.3
                )

            else ->
                NovaAutoProfile(
                    name = "CLEAN CORE",
                    params = NovaDspParams(
                        eqDb = listOf(0.05f, 0.15f, -0.40f, -0.10f, 0.25f, 0.15f, 0.10f),
                        deHarshPercent = 18f,
                        widthPercent = 102f,
                        dynamicEqPercent = 22f,
                        gluePercent = 16f
                    ),
                    targetLufs = -11.0,
                    ceilingDbtp = -1.3
                )
        }
    }
}
