const fs = require('fs');
const { withGradleProperties } = require('expo/config-plugins');

// Pin the JDK for the Android Gradle build to this project. The system JVM on
// the Linux dev box is currently OpenJDK 25, which breaks the
// reanimated/react-native-worklets CMake configure step ("restricted method in
// java.lang.System"). Point Gradle at a 17 install instead.
//
// Override the path per-machine with ANON_ANDROID_JAVA_HOME. If the resolved
// path doesn't exist (e.g. the macOS/iOS box), the plugin does nothing and
// Gradle falls back to JAVA_HOME / the system default.
const CANDIDATES = [
  process.env.ANON_ANDROID_JAVA_HOME,
  '/usr/lib/jvm/openjdk-bin-17',
  '/opt/openjdk-bin-17',
].filter(Boolean);

const javaHome = CANDIDATES.find((p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
});

module.exports = function withGradleJavaHome(config) {
  if (!javaHome) return config;
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'org.gradle.java.home')
    );
    cfg.modResults.push({ type: 'property', key: 'org.gradle.java.home', value: javaHome });
    return cfg;
  });
};
