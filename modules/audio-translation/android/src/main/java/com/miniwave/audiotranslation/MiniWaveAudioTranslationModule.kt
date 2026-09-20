package com.miniwave.audiotranslation

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.os.Process
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.FileOutputStream
import java.io.IOException
import java.util.Locale
import kotlin.math.max

class MiniWaveAudioTranslationModule : Module() {
  companion object {
    private const val PROJECTION_REQUEST_CODE = 49231
    private const val SAMPLE_RATE = 16000
  }

  private var mediaProjection: MediaProjection? = null
  private var audioRecord: AudioRecord? = null
  private var readerPfd: ParcelFileDescriptor? = null
  private var writerPfd: ParcelFileDescriptor? = null
  private var writerThread: Thread? = null
  private var speechRecognizer: SpeechRecognizer? = null
  private var lastEmittedText = ""
  private var pendingStart = false

  override fun definition() = ModuleDefinition {
    Name("MiniWaveAudioTranslation")
    Events("onSpeechResult", "onState")

    AsyncFunction("start") {
      startCapture()
    }

    Function("stop") {
      stopCapture()
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != PROJECTION_REQUEST_CODE) return@OnActivityResult
      pendingStart = false
      if (payload.resultCode != Activity.RESULT_OK || payload.data == null) {
        sendEvent("onState", mapOf("state" to "error", "message" to "لم يتم السماح بالتقاط صوت الجهاز."))
        return@OnActivityResult
      }
      startCaptureAfterPermission(payload.data!!)
    }

    OnDestroy {
      stopCapture()
    }
  }

  private fun startCapture() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      sendEvent("onState", mapOf("state" to "error", "message" to "الترجمة الصوتية تحتاج Android 13 أو أحدث."))
      return
    }

    if (speechRecognizer != null || audioRecord != null || pendingStart) return

    val context = appContext.reactContext ?: run {
      sendEvent("onState", mapOf("state" to "error", "message" to "تعذر الوصول إلى Android."))
      return
    }
    val activity = appContext.activityProvider?.currentActivity ?: run {
      sendEvent("onState", mapOf("state" to "error", "message" to "تعذر الوصول إلى نافذة التطبيق."))
      return
    }

    if (!SpeechRecognizer.isRecognitionAvailable(context)) {
      sendEvent("onState", mapOf("state" to "error", "message" to "خدمة التعرف على الكلام غير متاحة على هذا الجهاز."))
      return
    }

    val manager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    pendingStart = true
    activity.startActivityForResult(manager.createScreenCaptureIntent(), PROJECTION_REQUEST_CODE)
  }

  private fun startCaptureAfterPermission(data: Intent) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      sendEvent("onState", mapOf("state" to "error", "message" to "التقاط صوت التشغيل يحتاج Android 10 أو أحدث."))
      return
    }

    val context = appContext.reactContext ?: return
    val manager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    val projection = manager.getMediaProjection(Activity.RESULT_OK, data)
    mediaProjection = projection

    try {
      val captureConfig = android.media.AudioPlaybackCaptureConfiguration.Builder(projection)
        .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
        .addMatchingUsage(AudioAttributes.USAGE_GAME)
        .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
        .build()

      val format = AudioFormat.Builder()
        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
        .setSampleRate(SAMPLE_RATE)
        .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
        .build()

      val minBuffer = AudioRecord.getMinBufferSize(
        SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT
      )
      if (minBuffer <= 0) throw IllegalStateException("تعذر إنشاء مخزن الصوت.")

      audioRecord = AudioRecord.Builder()
        .setAudioFormat(format)
        .setBufferSizeInBytes(max(minBuffer * 2, 8192))
        .setAudioPlaybackCaptureConfig(captureConfig)
        .build()

      if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
        throw IllegalStateException("تعذر تهيئة التقاط صوت الفيديو.")
      }

      val pipe = ParcelFileDescriptor.createPipe()
      readerPfd = pipe[0]
      writerPfd = pipe[1]

      setupSpeechRecognizer(context)
      startAudioPump()
      audioRecord?.startRecording()

      sendEvent("onState", mapOf("state" to "started"))
    } catch (error: Throwable) {
      stopCapture()
      sendEvent(
        "onState",
        mapOf(
          "state" to "error",
          "message" to (error.message ?: "تعذر بدء الترجمة الصوتية.")
        )
      )
    }
  }

  private fun setupSpeechRecognizer(context: Context) {
    val source = readerPfd ?: throw IllegalStateException("مصدر الصوت غير متاح.")

    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context)
    speechRecognizer?.setRecognitionListener(object : RecognitionListener {
      override fun onReadyForSpeech(params: Bundle?) {}

      override fun onBeginningOfSpeech() {}

      override fun onRmsChanged(rmsdB: Float) {}

      override fun onBufferReceived(buffer: ByteArray?) {}

      override fun onEndOfSpeech() {}

      override fun onError(error: Int) {
        if (audioRecord != null) {
          sendEvent("onState", mapOf("state" to "recognition_error", "message" to "تعذر التعرف على الصوت ($error)."))
        }
      }

      override fun onResults(results: Bundle?) {
        emitResult(results)
      }

      override fun onPartialResults(partialResults: Bundle?) {
        emitResult(partialResults, partial = true)
      }

      override fun onEvent(eventType: Int, params: Bundle?) {}

      override fun onSegmentResults(segmentResults: Bundle) {
        emitResult(segmentResults)
      }

      override fun onEndOfSegmentedSession() {}
    })

    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.US.toLanguageTag())
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE, source)
      putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_CHANNEL_COUNT, 1)
      putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_ENCODING, AudioFormat.ENCODING_PCM_16BIT)
      putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_SAMPLING_RATE, SAMPLE_RATE)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        putExtra(RecognizerIntent.EXTRA_SEGMENTED_SESSION, RecognizerIntent.EXTRA_AUDIO_SOURCE)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        putExtra(RecognizerIntent.EXTRA_ENABLE_LANGUAGE_DETECTION, true)
      }
    }

    speechRecognizer?.startListening(intent)
  }

  private fun emitResult(bundle: Bundle?, partial: Boolean = false) {
    val text = bundle
      ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
      ?.firstOrNull()
      ?.trim()
      ?: return

    if (text.isEmpty() || text == lastEmittedText) return
    lastEmittedText = text

    var language: String? = null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      language = bundle?.getString(SpeechRecognizer.DETECTED_LANGUAGE)
    }

    sendEvent(
      "onSpeechResult",
      mapOf(
        "text" to text,
        "language" to (language ?: "en-US"),
        "partial" to partial
      )
    )
  }

  private fun startAudioPump() {
    val record = audioRecord ?: return
    val writer = writerPfd ?: return
    writerThread?.interrupt()

    writerThread = Thread {
      Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
      val output = FileOutputStream(writer.fileDescriptor)
      val buffer = ByteArray(8192)
      try {
        while (!Thread.currentThread().isInterrupted && audioRecord === record) {
          val count = record.read(buffer, 0, buffer.size, AudioRecord.READ_BLOCKING)
          if (count > 0) {
            output.write(buffer, 0, count)
            output.flush()
          } else if (count < 0) {
            break
          }
        }
      } catch (_: IOException) {
      } finally {
        try { output.flush() } catch (_: IOException) {}
      }
    }.also { it.start() }
  }

  private fun stopCapture() {
    pendingStart = false

    try { speechRecognizer?.cancel() } catch (_: Throwable) {}
    try { speechRecognizer?.destroy() } catch (_: Throwable) {}
    speechRecognizer = null

    try { audioRecord?.stop() } catch (_: Throwable) {}
    try { audioRecord?.release() } catch (_: Throwable) {}
    audioRecord = null

    try { writerPfd?.close() } catch (_: Throwable) {}
    try { readerPfd?.close() } catch (_: Throwable) {}
    writerPfd = null
    readerPfd = null

    writerThread?.interrupt()
    writerThread = null

    try { mediaProjection?.stop() } catch (_: Throwable) {}
    mediaProjection = null

    lastEmittedText = ""
    sendEvent("onState", mapOf("state" to "stopped"))
  }
}
