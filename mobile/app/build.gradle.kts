plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
}

val pocketApiBase = System.getenv("POCKET_API_BASE") ?: "https://money.joerakesh.tech/api"

android {
    namespace = "com.joerakesh.pocketsync"
    buildFeatures {
        buildConfig = true
    }
    compileSdk = 37

    defaultConfig {
        applicationId = "com.joerakesh.pocketsync"
        minSdk = 26
        targetSdk = 36
        versionCode = 2
        versionName = "0.3.0"
        buildConfigField("String", "API_BASE", "\"$pocketApiBase\"")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:34.5.0"))
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.android.gms:play-services-auth:21.4.0")
}
