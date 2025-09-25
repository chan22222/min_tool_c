// videoGeneratorMP4.js - Chrome에서 직접 MP4 생성하는 버전

(function() {
  'use strict';

  class VideoGeneratorMP4 {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.width = 1280;
      this.height = 720;
      this.transitions = ['fade', 'slide', 'zoom', 'rotate', 'wipe'];
    }

    initCanvas() {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.ctx = this.canvas.getContext('2d', { 
        alpha: false,
        desynchronized: true
      });
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
      
      if (transform) {
        this.ctx.translate(this.width / 2, this.height / 2);
        if (transform.rotate) this.ctx.rotate(transform.rotate);
        if (transform.scale) this.ctx.scale(transform.scale, transform.scale);
        this.ctx.translate(-this.width / 2, -this.height / 2);
        if (transform.translateX || transform.translateY) {
          this.ctx.translate(transform.translateX || 0, transform.translateY || 0);
        }
      }
      
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

    getRandomTransition() {
      return this.transitions[Math.floor(Math.random() * this.transitions.length)];
    }

    async applyTransition(img1, img2, type, progress) {
      this.ctx.clearRect(0, 0, this.width, this.height);
      
      switch(type) {
        case 'fade':
          this.drawImage(img1, 1 - progress);
          this.drawImage(img2, progress);
          break;
          
        case 'slide':
          this.drawImage(img1, 1, { translateX: -this.width * progress });
          this.drawImage(img2, 1, { translateX: this.width * (1 - progress) });
          break;
          
        case 'zoom':
          this.drawImage(img1, 1 - progress, { scale: 1 + progress });
          this.drawImage(img2, progress, { scale: 2 - progress });
          break;
          
        case 'rotate':
          this.drawImage(img1, 1 - progress, { rotate: progress * Math.PI / 4 });
          this.drawImage(img2, progress, { rotate: -((1 - progress) * Math.PI / 4) });
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

    // Chrome에서 MP4 지원 확인
    static canGenerateMP4() {
      // Chrome 브라우저 확인
      const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
      const isEdge = /Edg/.test(navigator.userAgent);
      
      if (!isChrome && !isEdge) {
        return false;
      }
      
      // MediaRecorder가 H.264를 지원하는지 확인
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        return MediaRecorder.isTypeSupported('video/mp4;codecs=h264') ||
               MediaRecorder.isTypeSupported('video/mp4') ||
               MediaRecorder.isTypeSupported('video/webm;codecs=h264');
      }
      
      return false;
    }

    // 최적의 MIME 타입 선택
    static getBestMimeType() {
      const mimeTypes = [
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=h264',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
      ];
      
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        for (const mimeType of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mimeType)) {
            console.log('선택된 MIME 타입:', mimeType);
            return mimeType;
          }
        }
      }
      
      return 'video/webm'; // 기본값
    }

    async createSlideshow(images, options = {}) {
      const config = {
        slideDuration: options.slideDuration || 1000,  // 1초로 단축
        transitionDuration: options.transitionDuration || 200,  // 0.2초로 단축
        fps: options.fps || 30,
        onProgress: options.onProgress || (() => {})
      };

      this.initCanvas();
      
      if (!window.MediaRecorder) {
        throw new Error('MediaRecorder not supported');
      }

      // 최적의 MIME 타입 선택
      const mimeType = VideoGeneratorMP4.getBestMimeType();
      const isMP4 = mimeType.includes('mp4') || mimeType.includes('h264');
      
      config.onProgress(`비디오 생성 중... (${isMP4 ? 'MP4' : 'WebM'} 형식)`);

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

        recorder.start(100);

        // 이미지 미리 로드
        config.onProgress('이미지 로드 중...');
        const loadedImages = await Promise.all(
          images.map(src => this.loadImage(src))
        );

        // 렌더링
        for (let i = 0; i < loadedImages.length; i++) {
          config.onProgress(`비디오 생성 중... ${i + 1}/${loadedImages.length}`);
          
          const currentImg = loadedImages[i];
          
          // 이미지 표시
          const slideFrames = Math.floor(config.slideDuration * config.fps / 1000);
          
          for (let f = 0; f < slideFrames; f++) {
            this.drawImage(currentImg);
            await new Promise(r => setTimeout(r, 1000 / config.fps));
          }
          
          // 전환 효과
          if (i < loadedImages.length - 1) {
            const nextImg = loadedImages[i + 1];
            const transition = this.getRandomTransition();
            const transitionFrames = Math.floor(config.transitionDuration * config.fps / 1000);
            
            for (let f = 0; f < transitionFrames; f++) {
              const progress = f / transitionFrames;
              await this.applyTransition(currentImg, nextImg, transition, progress);
              await new Promise(r => setTimeout(r, 1000 / config.fps));
            }
          }
        }

        // 마지막 프레임 유지
        await new Promise(r => setTimeout(r, 300));
        recorder.stop();
      });
    }
  }

  // 전역 등록
  window.VideoGeneratorMP4 = VideoGeneratorMP4;
})();