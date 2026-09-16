# NOVA RED LINE release rules.
-keep class com.novastage.novaredline.NovaRenderService { *; }
-keepclassmembers class * {
    @androidx.annotation.Keep *;
}
