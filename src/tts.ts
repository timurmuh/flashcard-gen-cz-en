import {spawn} from "child_process";
import {mkdir} from "fs/promises";
import {dirname} from "path";

// Constants
const TTS_CLI_PATH = ".venv/bin/tts";
const TTS_MODEL_NAME = "tts_models/cs/cv/vits";
const AUDIO_FILE_EXTENSION = ".wav";

export type SpeechGenerationResult = SpeechGenerationSuccess | SpeechGenerationError;
export type SpeechGenerationError = {
  text: string;
  outputFile: string;
  success: boolean;
  error: string;
  code?: number;
  stderr?: string;
  stdout?: string;
}

export type SpeechGenerationSuccess = {
  text: string;
  outputFile: string;
  success: boolean;
  code?: number;
  stderr?: string;
  stdout?: string;
}

export function isSpeechGenerationError(result: SpeechGenerationResult): result is SpeechGenerationError {
  return !result.success;
}

export function isSpeechGenerationSuccess(result: SpeechGenerationResult): result is SpeechGenerationSuccess {
  return result.success;
}

/**
 * Generate a text-to-speech audio file using the specified CLI utility
 *
 * @param text - The text to convert to speech
 * @param outPath - The output path (without extension) where the audio file will be saved
 * @returns A Promise with information about the generation
 */
export async function generateSpeech(
  text: string,
  outPath: string
): Promise<SpeechGenerationResult> {
  // Ensure the output path has the correct extension
  const fullOutPath = outPath.endsWith(AUDIO_FILE_EXTENSION)
    ? outPath
    : `${outPath}${AUDIO_FILE_EXTENSION}`;

  // Ensure the directory exists
  const outputDir = dirname(fullOutPath);
  await mkdir(outputDir, {recursive: true});

  return new Promise((resolve, reject) => {
    const process = spawn(TTS_CLI_PATH, [
      "--model_name", TTS_MODEL_NAME,
      "--out_path", fullOutPath,
      "--text", text
    ]);

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve({
          text,
          outputFile: fullOutPath,
          success: true,
        });
      } else {
        reject({
          text,
          outputFile: fullOutPath,
          success: false,
          error: stderr || "Unknown error occurred",
          code,
          stderr,
          stdout,
        });
      }
    });

    process.on("error", (err) => {
      reject({
        text,
        outputFile: fullOutPath,
        success: false,
        error: err.message,
        stderr,
        stdout,
      });
    });
  });
}
