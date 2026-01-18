import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

// Transcoding configuration - easy to modify
const TRANSCODE_CRF = 18; // 0-51, lower = better quality (18 = visually lossless)
const TRANSCODE_PRESET = 'slow'; // ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow
const TRANSCODE_AUDIO_BITRATE = '256k';

// Web-compatible codecs
const WEB_COMPATIBLE_VIDEO_CODECS = ['h264', 'avc1', 'avc'];
const WEB_COMPATIBLE_AUDIO_CODECS = ['aac', 'mp4a'];

export interface VideoCodecInfo {
  container: string;
  videoCodec: string | null;
  audioCodec: string | null;
  isWebCompatible: boolean;
}

export interface TranscodeResult {
  outputPath: string;
  transcoded: boolean;
  originalDeleted: boolean;
  outputMimeType: string;
}

/**
 * Analyze video codecs using ffprobe
 */
export async function analyzeVideoCodecs(filePath: string): Promise<VideoCodecInfo> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`
    );

    const probe = JSON.parse(stdout);

    const videoStream = probe.streams?.find(
      (s: { codec_type: string }) => s.codec_type === 'video'
    );
    const audioStream = probe.streams?.find(
      (s: { codec_type: string }) => s.codec_type === 'audio'
    );

    const container = probe.format?.format_name?.split(',')[0] || 'unknown';
    const videoCodec = videoStream?.codec_name?.toLowerCase() || null;
    const audioCodec = audioStream?.codec_name?.toLowerCase() || null;

    // Check if web compatible
    const isMP4Container = container === 'mov' && filePath.endsWith('.mp4') || container === 'mp4';
    const isH264 = videoCodec && WEB_COMPATIBLE_VIDEO_CODECS.includes(videoCodec);
    const isAACOrNoAudio = !audioCodec || WEB_COMPATIBLE_AUDIO_CODECS.includes(audioCodec);

    const isWebCompatible = isMP4Container && isH264 && isAACOrNoAudio;

    return {
      container,
      videoCodec,
      audioCodec,
      isWebCompatible,
    };
  } catch (error) {
    console.warn('Failed to analyze video codecs:', error);
    // Assume not web compatible if analysis fails
    return {
      container: 'unknown',
      videoCodec: null,
      audioCodec: null,
      isWebCompatible: false,
    };
  }
}

/**
 * Check if video needs transcoding
 */
export function needsTranscoding(codecInfo: VideoCodecInfo): boolean {
  return !codecInfo.isWebCompatible;
}

/**
 * Transcode video to MP4/H.264/AAC format
 */
export async function transcodeVideo(
  inputPath: string,
  outputPath: string
): Promise<TranscodeResult> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-crf', String(TRANSCODE_CRF),
      '-preset', TRANSCODE_PRESET,
      '-pix_fmt', 'yuv420p', // Maximum browser compatibility
      '-c:a', 'aac',
      '-b:a', TRANSCODE_AUDIO_BITRATE,
      '-movflags', '+faststart', // Enable instant playback
      '-y', // Overwrite output
      outputPath,
    ];

    console.log(`Transcoding: ffmpeg ${args.join(' ')}`);

    const ffmpeg = spawn('ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';

    ffmpeg.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', async (code) => {
      if (code === 0) {
        // Transcoding successful, delete original
        try {
          await fs.unlink(inputPath);
          resolve({
            outputPath,
            transcoded: true,
            originalDeleted: true,
            outputMimeType: 'video/mp4',
          });
        } catch (unlinkError) {
          // Original file deletion failed, but transcoding succeeded
          console.warn('Failed to delete original file:', unlinkError);
          resolve({
            outputPath,
            transcoded: true,
            originalDeleted: false,
            outputMimeType: 'video/mp4',
          });
        }
      } else {
        // Transcoding failed, clean up partial output
        try {
          await fs.unlink(outputPath);
        } catch {
          // Ignore cleanup errors
        }
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', async (error) => {
      // Clean up partial output
      try {
        await fs.unlink(outputPath);
      } catch {
        // Ignore cleanup errors
      }
      reject(new Error(`FFmpeg spawn error: ${error.message}`));
    });
  });
}

/**
 * Check if FFmpeg is available
 */
export async function checkFfmpegAvailable(): Promise<boolean> {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Clean up orphaned temp files (files with _temp in name older than 1 hour)
 */
export async function cleanupOrphanedTempFiles(videoDir: string): Promise<void> {
  try {
    const files = await fs.readdir(videoDir);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    for (const file of files) {
      if (file.includes('_temp')) {
        const filePath = `${videoDir}/${file}`;
        try {
          const stat = await fs.stat(filePath);
          if (stat.mtime.getTime() < oneHourAgo) {
            await fs.unlink(filePath);
            console.log(`Cleaned up orphaned temp file: ${file}`);
          }
        } catch {
          // Ignore errors for individual files
        }
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup orphaned temp files:', error);
  }
}
