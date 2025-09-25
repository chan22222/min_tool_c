// videoGeneratorSimple.js - 향상된 비디오 생성 (다양한 효과 & 최적화)

(function() {
  'use strict';

  class VideoGenerator {
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
        img.onerror = reject;        img.src = src;
      });
    }

    drawImage(img, opacity = 1, transform = null) {
      this.ctx.save();
      this.ctx.globalAlpha = opacity;
      
      // 변환 적용
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
      const h = img.height * scale;      const x = (this.width - w) / 2;
      const y = (this.height - h) / 2;
      
      this.ctx.drawImage(img, x, y, w, h);
      this.ctx.restore();
    }

    // 랜덤 전환 효과 선택
    getRandomTransition() {
      return this.transitions[Math.floor(Math.random() * this.transitions.length)];
    }

    // 전환 효과 적용
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

      // 정상 FPS로 스트림 생성
      const stream = this.canvas.captureStream(config.fps);
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8',
        videoBitsPerSecond: 1000000  // 1Mbps로 감소
      });
      
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      return new Promise(async (resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          resolve(blob);
        };

        recorder.start(100);

        // 이미지 미리 로드
        config.onProgress('이미지 로드 중...');
        const loadedImages = await Promise.all(
          images.map(src => this.loadImage(src))
        );
        // 렌더링 - 적절한 타이밍으로
        for (let i = 0; i < loadedImages.length; i++) {
          config.onProgress(`비디오 생성 중... ${i + 1}/${loadedImages.length}`);
          
          const currentImg = loadedImages[i];
          
          // 이미지 표시 (2초간 유지)
          const slideFrames = Math.floor(config.slideDuration * config.fps / 1000);
          
          for (let f = 0; f < slideFrames; f++) {
            this.drawImage(currentImg);
            // 정확한 프레임 타이밍을 위한 대기
            await new Promise(r => setTimeout(r, 1000 / config.fps));
          }
          
          // 전환 효과 (마지막 이미지가 아닌 경우)
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
        await new Promise(r => setTimeout(r, 300));        recorder.stop();
      });
    }
  }

  // 전역 등록
  window.VideoGenerator = VideoGenerator;
})();