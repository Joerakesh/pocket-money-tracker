plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.joerakesh.pocketsync"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.joerakesh.pocketsync"
        minSdk = 26
        targetSdk = 36
        versionCode = 2
        versionName = "0.2.0"
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
