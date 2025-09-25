// videoGeneratorOptimized.js - 최적화된 빠른 인코딩 버전

(function() {
  'use strict';

  class VideoGeneratorOptimized {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.width = 1280;
      this.height = 720;
      // 단순한 전환 효과만 사용 (렌더링 빠른 것들)
      this.transitions = ['fade', 'wipe'];
    }

    initCanvas() {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.ctx = this.canvas.getContext('2d', { 
        alpha: false,
        desynchronized: true,
        willReadFrequently: false
      });
      // 품질 낮춤 for 속도
      this.ctx.imageSmoothingEnabled = false;
    }

    async loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    }

    drawImage(img, opacity = 1, transform = null) {
      this.ctx.save();
      this.ctx.globalAlpha = opacity;
      
      // 검은 배경
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, this.width, this.height);
      
      // 이미지를 중앙에 맞추기
      const scale = Math.min(
        this.width / img.width,
        this.height / img.height
      );
      
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (this.width - w) / 2;
      const y = (this.height - h) / 2;
      
      this.ctx.drawImage(img, x, y, w, h);
      this.ctx.restore();
    }
    async applyTransition(img1, img2, type, progress) {
      this.ctx.clearRect(0, 0, this.width, this.height);
      
      switch(type) {
        case 'fade':
          this.drawImage(img1, 1 - progress);
          this.drawImage(img2, progress);
          break;
          
        case 'wipe':
          this.ctx.save();
          this.drawImage(img1);
          this.ctx.beginPath();
          this.ctx.rect(0, 0, this.width * progress, this.height);
          this.ctx.clip();
          this.drawImage(img2);
          this.ctx.restore();
          break;
          
        default:
          this.drawImage(img1, 1 - progress);
          this.drawImage(img2, progress);
      }
    }

    static getBestMimeType() {
      const mimeTypes = [
        'video/webm;codecs=vp8', // VP8이 더 빠름
        'video/webm',
        'video/mp4;codecs=h264',
        'video/mp4'
      ];      
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        for (const mimeType of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mimeType)) {
            console.log('선택된 MIME 타입:', mimeType);
            return mimeType;
          }
        }
      }
      
      return 'video/webm';
    }

    async createSlideshow(images, options = {}) {
      // 빠른 인코딩을 위한 최적화된 설정
      const config = {
        slideDuration: options.slideDuration || 1000,  // 1초로 단축
        transitionDuration: options.transitionDuration || 200,  // 0.2초로 단축
        fps: options.fps || 15,  // 15fps로 감소
        maxImages: options.maxImages || Math.floor(images.length / 2), // 이미지 수 절반으로
        onProgress: options.onProgress || (() => {})
      };

      this.initCanvas();
      
      if (!window.MediaRecorder) {
        throw new Error('MediaRecorder not supported');
      }

      const mimeType = VideoGeneratorOptimized.getBestMimeType();
      const isMP4 = mimeType.includes('mp4');      
      config.onProgress(`비디오 생성 중... (${isMP4 ? 'MP4' : 'WebM'} 형식, 최적화 모드)`);

      const stream = this.canvas.captureStream(config.fps);
      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 1000000  // 1Mbps로 감소
      });
      
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      return new Promise(async (resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { 
            type: isMP4 ? 'video/mp4' : 'video/webm' 
          });
          resolve({ blob, isMP4 });
        };

        recorder.start();

        // 이미지 미리 로드 (절반만 사용)
        const selectedImages = images.slice(0, config.maxImages);
        config.onProgress(`이미지 로드 중... (${selectedImages.length}개 사용)`);
        const loadedImages = await Promise.all(
          selectedImages.map(src => this.loadImage(src))
        );
        // 빠른 렌더링
        const frameDelay = 1000 / config.fps;
        
        for (let i = 0; i < loadedImages.length; i++) {
          config.onProgress(`비디오 생성 중... ${i + 1}/${loadedImages.length}`);
          
          const currentImg = loadedImages[i];
          
          // 이미지 표시 (프레임 수 감소)
          const slideFrames = Math.floor(config.slideDuration * config.fps / 1000);
          
          for (let f = 0; f < slideFrames; f += 2) { // 2프레임씩 건너뛰기
            this.drawImage(currentImg);
            await new Promise(r => setTimeout(r, frameDelay * 2));
          }
          
          // 전환 효과 (마지막 이미지가 아닐 때만)
          if (i < loadedImages.length - 1) {
            const nextImg = loadedImages[i + 1];
            const transition = this.transitions[i % 2]; // fade와 wipe 번갈아가며
            const transitionFrames = Math.floor(config.transitionDuration * config.fps / 1000);
            
            for (let f = 0; f < transitionFrames; f++) {
              const progress = f / transitionFrames;
              await this.applyTransition(currentImg, nextImg, transition, progress);
              await new Promise(r => setTimeout(r, frameDelay));
            }
          }
        }
        // 종료
        recorder.stop();
      });
    }

    // 빠른 프리뷰 생성용 메서드
    async createQuickPreview(images, options = {}) {
      return this.createSlideshow(images, {
        slideDuration: 500,  // 0.5초
        transitionDuration: 100,  // 0.1초
        fps: 10,  // 10fps
        maxImages: Math.min(5, images.length),  // 최대 5개 이미지
        ...options
      });
    }
  }

  // 전역 등록
  window.VideoGeneratorOptimized = VideoGeneratorOptimized;
})();