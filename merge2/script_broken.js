// 모듈 import 제거 - 전역 객체로 접근

// FFmpeg 인스턴스를 전역으로 관리
let ffmpegInstance = null;

// FFmpeg.wasm 초기화 및 인스턴스 반환
async function getFFmpegInstance() {
  if (ffmpegInstance) {
    return ffmpegInstance;
  }
  
  try {
    // FFmpeg가 이미 로드되어 있는지 확인
    if (typeof FFmpeg === 'undefined') {
      throw new Error('FFmpeg.wasm이 로드되지 않았습니다.');
    }
    
    const { createFFmpeg } = FFmpeg;
    ffmpegInstance = createFFmpeg({ 
      log: false,
      corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      progress: ({ ratio }) => {
        if (ratio >= 0 && ratio <= 1) {
          const percent = Math.round(ratio * 100);
          window.Utils.showExportStatus(`MP4 변환 중... ${percent}%`);
        }
      }
    });
    
    if (!ffmpegInstance.isLoaded()) {
      window.Utils.showExportStatus("FFmpeg 엔진 로드 중...");
      await ffmpegInstance.load();
      console.log('FFmpeg.wasm 초기화 완료');
    }
    
    return ffmpegInstance;
  } catch (error) {
    console.error('FFmpeg 초기화 실패:', error);
    ffmpegInstance = null;
    throw error;
  }
}

// WebM to MP4 변환 함수
async function convertWebMToMP4(webmBlob) {
  try {
    const ffmpeg = await getFFmpegInstance();
    const { fetchFile } = FFmpeg;
    
    // 입력 파일명 생성 (타임스탬프 사용)
    const timestamp = Date.now();
    const inputName = `input_${timestamp}.webm`;
    const outputName = `output_${timestamp}.mp4`;
    
    // WebM 파일을 FFmpeg 파일 시스템에 쓰기
    window.Utils.showExportStatus("비디오 파일 준비 중...");
    const webmData = await fetchFile(webmBlob);
    ffmpeg.FS('writeFile', inputName, webmData);
    
    // WebM을 MP4로 변환
    window.Utils.showExportStatus("MP4로 변환 중...");
    await ffmpeg.run(
      '-i', inputName,
      '-c:v', 'libx264',      // H.264 비디오 코덱
      '-preset', 'medium',     // 인코딩 속도/품질 균형
      '-crf', '23',           // 품질 (낮을수록 좋음, 18-28 권장)
      '-pix_fmt', 'yuv420p',  // 호환성을 위한 픽셀 포맷
      '-movflags', '+faststart', // 웹 스트리밍 최적화
      outputName
    );
    
    // 변환된 MP4 파일 읽기
    const mp4Data = ffmpeg.FS('readFile', outputName);
    const mp4Blob = new Blob([mp4Data.buffer], { type: 'video/mp4' });
    
    // 메모리 정리
    try {
      ffmpeg.FS('unlink', inputName);
      ffmpeg.FS('unlink', outputName);
    } catch (e) {
      console.warn('파일 정리 중 오류:', e);
    }
    
    console.log(`MP4 변환 완료: ${(mp4Blob.size / 1024 / 1024).toFixed(2)} MB`);
    return mp4Blob;
    
  } catch (error) {
    console.error('MP4 변환 실패:', error);
    throw error;
  }
}

class PhotoClassifierApp {
  constructor() {
    this.categoryManager = new window.CategoryManager();
    this.stateManager = new window.StateManager(this.categoryManager);
    
    // 전역 상태 관리 (전역 네임스페이스 오염 최소화)
    this.initializeGlobalState();
    
    // 이벤트 리스너 정리를 위한 배열
    this.eventListeners = [];
