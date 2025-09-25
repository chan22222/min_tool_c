// 유틸리티 함수들
window.Utils = class Utils {
  // 이미지 리사이징 함수 (업로드 시 크기 제한)
  static resizeImageForUpload(file, maxPixels = 1200, quality = 0.95) {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        let { width, height } = img;
        
        // 가로 또는 세로 중 하나라도 maxPixels를 초과하면 리사이징
        if (width > maxPixels || height > maxPixels) {
          const aspectRatio = width / height;
          
          if (width > height) {
            // 가로가 더 긴 경우
            width = maxPixels;
            height = maxPixels / aspectRatio;
          } else {
            // 세로가 더 긴 경우
            height = maxPixels;
            width = maxPixels * aspectRatio;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 이미지 그리기
        ctx.drawImage(img, 0, 0, width, height);
        
        // Blob으로 변환
        canvas.toBlob((blob) => {
          // File 객체로 변환
          const resizedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: file.lastModified
          });
          
          console.log(`이미지 리사이징: ${file.name} - 원본: ${(file.size/1024).toFixed(1)}KB (${img.width}x${img.height}) -> 리사이징: ${(resizedFile.size/1024).toFixed(1)}KB (${width}x${height})`);
          resolve(resizedFile);
        }, 'image/jpeg', quality);
      };
      
      const reader = new FileReader();
      reader.onload = e => img.src = e.target.result;
      reader.readAsDataURL(file);
    });
  }

  // Base64 변환 함수들 (압축된 이미지 저장용)
  static fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        data: reader.result,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  static base64ToFile(base64Data) {
    const { data, name, type, lastModified } = base64Data;
    const byteString = atob(data.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new File([ab], name, { type, lastModified });
  }

  // 이미지 해시 생성
  static async generateImageHash(file) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const size = 16;
        canvas.width = size;
        canvas.height = size;
        
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        
        let total = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
          const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
          total += gray;
        }
        const average = total / (size * size);
        
        let hash = '';
        for (let i = 0; i < imageData.data.length; i += 4) {
          const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
          hash += gray > average ? '1' : '0';
        }
        
        resolve(hash);
      };
      
      const reader = new FileReader();
      reader.onload = e => img.src = e.target.result;
      reader.readAsDataURL(file);
    });
  }

  // 해시 유사도 계산
  static calculateHashSimilarity(hash1, hash2) {
    if (hash1.length !== hash2.length) return 0;
    
    let differences = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) differences++;
    }
    
    return 1 - (differences / hash1.length);
  }

  static getImageKey(file) {
    return `${file.name}_${file.size}_${file.lastModified}`;
  }

  // 버튼 로딩 상태 관리
  static setButtonLoading(button, loading, originalText) {
    if (loading) {
      button.classList.add('loading');
      button.disabled = true;
      button.dataset.originalText = button.textContent;
    } else {
      button.classList.remove('loading');
      button.disabled = false;
      button.textContent = button.dataset.originalText || originalText;
    }
  }

  // 처리 중 메시지 표시
  static showProcessingMessage(message, duration = 2000) {
    const msgElement = document.getElementById('processingMessage');
    msgElement.textContent = message;
    msgElement.style.display = 'block';
    setTimeout(() => {
      msgElement.style.display = 'none';
    }, duration);
  }

  // 프로그레스 바 표시
  static showProgressBar(percent) {
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    progressBar.style.display = 'block';
    progressFill.style.width = percent + '%';
    progressFill.textContent = Math.round(percent) + '%';
  }

  static hideProgressBar() {
    setTimeout(() => {
      document.getElementById('progressBar').style.display = 'none';
    }, 500);
  }

  // Export 상태 표시 함수들
  static showExportStatus(message) {
    const exportStatus = document.getElementById("export-status");
    exportStatus.textContent = message;
    exportStatus.style.display = "block";
  }

  static hideExportStatus() {
    setTimeout(() => { 
      document.getElementById("export-status").style.display = "none"; 
    }, 2000);
  }

  // Export 관련 유틸리티
  static dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], {type:mime});
  }

  // 테두리 추가 함수
  static addBorderToImage(imgSrc, borderOptions) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 테두리 두께
        const borderWidth = borderOptions.width || 1;
        
        // 새로운 캔버스 크기 (원본 + 테두리)
        canvas.width = img.width + (borderWidth * 2);
        canvas.height = img.height + (borderWidth * 2);
        
        // 테두리 색상 생성
        const borderColor = this.generateBorderColor(borderOptions.color || 'white');
        
        // 테두리 그리기
        ctx.fillStyle = borderColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 원본 이미지를 테두리 안쪽에 그리기
        ctx.drawImage(img, borderWidth, borderWidth);
        
        // blob으로 변환
        canvas.toBlob(resolve, 'image/jpeg', 0.98);
      };
      img.src = imgSrc;
    });
  }

  // 테두리 색상 생성 (랜덤)
  static generateBorderColor(colorType) {
    let r, g, b;
    
    switch (colorType) {
      case 'white':
        // RGB 240~255 랜덤
        r = Math.floor(Math.random() * 16) + 240; // 240-255
        g = Math.floor(Math.random() * 16) + 240;
        b = Math.floor(Math.random() * 16) + 240;
        break;
      case 'gray':
        // RGB 135~150 랜덤
        r = Math.floor(Math.random() * 16) + 135; // 135-150
        g = Math.floor(Math.random() * 16) + 135;
        b = Math.floor(Math.random() * 16) + 135;
        break;
      case 'black':
        // RGB 0~15 랜덤
        r = Math.floor(Math.random() * 16); // 0-15
        g = Math.floor(Math.random() * 16);
        b = Math.floor(Math.random() * 16);
        break;
      default:
        // 기본값: 화이트
        r = Math.floor(Math.random() * 16) + 240;
        g = Math.floor(Math.random() * 16) + 240;
        b = Math.floor(Math.random() * 16) + 240;
    }
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  // 노이즈 추가 함수
  static addNoiseToImage(imgSrc, noiseOptions) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 원본 이미지 그리기
        ctx.drawImage(img, 0, 0);
        
        // 이미지 데이터 가져오기
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        const noiseCount = noiseOptions.count || 10;
        const edgeSize = 50; // 가장자리 50px
        
        // 노이즈 추가
        for (let i = 0; i < noiseCount; i++) {
          // 랜덤 위치 선택 (가장자리 50px 영역)
          let x, y;
          
          const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
          
          switch (side) {
            case 0: // 상단
              x = Math.floor(Math.random() * canvas.width);
              y = Math.floor(Math.random() * edgeSize);
              break;
            case 1: // 우측
              x = canvas.width - Math.floor(Math.random() * edgeSize) - 1;
              y = Math.floor(Math.random() * canvas.height);
              break;
            case 2: // 하단
              x = Math.floor(Math.random() * canvas.width);
              y = canvas.height - Math.floor(Math.random() * edgeSize) - 1;
              break;
            case 3: // 좌측
              x = Math.floor(Math.random() * edgeSize);
              y = Math.floor(Math.random() * canvas.height);
              break;
          }
          
          // 픽셀 인덱스 계산
          const pixelIndex = (y * canvas.width + x) * 4;
          
          if (pixelIndex >= 0 && pixelIndex < data.length - 3) {
            // 원본 RGB 값
            const originalR = data[pixelIndex];
            const originalG = data[pixelIndex + 1];
            const originalB = data[pixelIndex + 2];
            
            // ±15 범위 내에서 색상 변경 (최소 5 이상 변화)
            const variation = 15;
            const minChange = 5;
            
            // 랜덤 변화량 계산 (최소 minChange 이상)
            const getRandomChange = () => {
              const change = Math.random() * variation * 2 - variation;
              if (Math.abs(change) < minChange) {
                return change > 0 ? minChange : -minChange;
              }
              return change;
            };
            
            const newR = Math.max(0, Math.min(255, originalR + getRandomChange()));
            const newG = Math.max(0, Math.min(255, originalG + getRandomChange()));
            const newB = Math.max(0, Math.min(255, originalB + getRandomChange()));
            
            // 새로운 색상 적용
            data[pixelIndex] = Math.round(newR);
            data[pixelIndex + 1] = Math.round(newG);
            data[pixelIndex + 2] = Math.round(newB);
            // Alpha는 그대로 유지 (data[pixelIndex + 3])
          }
        }
        
        // 수정된 이미지 데이터를 캔버스에 적용
        ctx.putImageData(imageData, 0, 0);
        
        // blob으로 변환
        canvas.toBlob(resolve, 'image/jpeg', 0.98);
      };
      img.src = imgSrc;
    });
  }

  // EXIF 정보 제거 함수 (Canvas로 다시 그리면 자동으로 EXIF 제거됨)
  static removeExifData(imgSrc) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 원본 이미지 그리기 (EXIF 정보는 자동으로 제거됨)
        ctx.drawImage(img, 0, 0);
        
        // blob으로 변환
        canvas.toBlob(resolve, 'image/jpeg', 0.98);
      };
      img.src = imgSrc;
    });
  }

  // 밝기/대비 조절 함수
  static adjustBrightnessContrast(imgSrc) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 랜덤 밝기/대비 값 생성 (1~3% 범위)
        const brightnessChange = (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1); // ±1~3%
        const contrastChange = (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1); // ±1~3%
        
        // 밝기: 100 + 변화량, 대비: 100 + 변화량
        const brightness = 100 + brightnessChange;
        const contrast = 100 + contrastChange;
        
        // CSS 필터 적용
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
        
        // 이미지 그리기
        ctx.drawImage(img, 0, 0);
        
        // blob으로 변환
        canvas.toBlob(resolve, 'image/jpeg', 0.98);
      };
      img.src = imgSrc;
    });
  }
} 