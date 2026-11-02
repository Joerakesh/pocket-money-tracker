plugins {
    id("com.android.application")
}

android {
    namespace = "com.joerakesh.pocketsync"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.joerakesh.pocketsync"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
