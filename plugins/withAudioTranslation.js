const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAudioTranslation(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.queries = manifest.queries || [];
    const hasRecognitionQuery = manifest.queries.some((query) =>
      query.intent?.some((intent) =>
        intent.action?.some((action) => action.$?.['android:name'] === 'android.speech.RecognitionService')
      )
    );
    if (!hasRecognitionQuery) {
      manifest.queries.push({
        intent: [
          {
            action: [
              { $: { 'android:name': 'android.speech.RecognitionService' } }
            ]
          }
        ]
      });
    }
    return config;
  });
};
