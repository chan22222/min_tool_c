// manuscriptGenerator.js - iframe 통신 및 원고 생성 모듈

class ManuscriptGenerator {
  constructor() {
    this.iframe = null;
    this.manuscriptContent = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // AI 원고 토글 이벤트
    const aiToggle = document.getElementById('aiManuscriptToggle');
    if (aiToggle) {
      aiToggle.addEventListener('change', (e) => {
        const container = document.getElementById('ai-manuscript-container');
        if (container) {
          if (e.target.checked) {
            container.style.display = 'block';
            this.initIframe();
          } else {
            container.style.display = 'none';
          }
        }
      });
    }

    // iframe과의 메시지 통신 설정
    window.addEventListener('message', (event) => {
      // 보안을 위해 origin 체크 (필요시)
      // if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'REQUEST_IMAGES') {
        // iframe에서 이미지 요청시 전달
        this.sendImagesToIframe();
      } else if (event.data.type === 'MANUSCRIPT_GENERATED') {
        // 원고가 생성되면 저장
        this.manuscriptContent = event.data.content;
        console.log('원고 생성 완료, 글자수:', event.data.charCount);
        window.Utils.showProcessingMessage(`원고 생성 완료! (${event.data.charCount}자)`);
      } else if (event.data.type === 'MANUSCRIPT_UPDATED') {
        // 원고가 수정되면 업데이트
        this.manuscriptContent = event.data.content;
      } else if (event.data.type === 'API_KEY_REQUEST') {
        // API 키 요청시 전달
        const apiKey = localStorage.getItem('gemini_api_key');
        if (apiKey) {
          this.sendMessageToIframe({ type: 'API_KEY', key: apiKey });
        }
      } else if (event.data.type === 'API_KEY_SAVE') {
        // API 키 저장 요청
        localStorage.setItem('gemini_api_key', event.data.key);
      }
    });
  }

  initIframe() {
    this.iframe = document.getElementById('ai-manuscript-iframe');
    if (this.iframe) {
      // iframe 로드 완료 후 초기화
      this.iframe.onload = () => {
        console.log('AI 원고 생성 iframe 로드 완료');
        // 이미지 전달
        setTimeout(() => {
          this.sendImagesToIframe();
        }, 500);
      };
    }
  }

  async sendImagesToIframe() {
    if (!this.iframe) return;

    try {
      // finalPreview의 이미지들 수집
      const imgs = document.querySelectorAll("#finalPreview img");
      const imageDataArray = [];
      
      for (let i = 0; i < Math.min(imgs.length, 20); i++) {
        const img = imgs[i];
        const category = img.dataset.category || `이미지${i+1}`;
        
        // 이미지를 base64로 변환
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const tempImg = new Image();
        
        await new Promise((resolve) => {
          tempImg.onload = () => {
            canvas.width = tempImg.width;
            canvas.height = tempImg.height;
            ctx.drawImage(tempImg, 0, 0);
            
            canvas.toBlob((blob) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                imageDataArray.push({
                  data: reader.result,
                  category: category,
                  index: i + 1
                });
                resolve();
              };
              reader.readAsDataURL(blob);
            }, 'image/jpeg', 0.9);
          };
          tempImg.src = img.src;
        });
      }

      // store-name과 store-info 수집
      let storeName = '';
      let storeInfo = '';
      
      // 현재 프로젝트에서 post_data 가져오기
      if (window.app && window.app.stateManager) {
        const stateName = window.app.currentDocumentName || document.getElementById('stateName')?.value;
        if (stateName) {
          try {
            // 서버에서 프로젝트 정보 가져오기
            const response = await fetch('./api/projects.php');
            const data = await response.json();
            if (data.success && data.data) {
              const project = data.data.find(p => p.name === stateName);
              if (project && project.post_data) {
                storeName = project.post_data.storeName || '';
                storeInfo = project.post_data.storeInfo || '';
              }
            }
          } catch (error) {
            console.log('post_data 로드 실패:', error);
          }
        }
      }
      
      // iframe에 이미지 전달
      this.sendMessageToIframe({
        type: 'IMAGES_DATA',
        images: imageDataArray,
        storeName: storeName,
        storeInfo: storeInfo
      });

      console.log(`${imageDataArray.length}개의 이미지를 iframe에 전달했습니다.`);
    } catch (error) {
      console.error('이미지 전달 오류:', error);
    }
  }

  sendMessageToIframe(data) {
    if (this.iframe && this.iframe.contentWindow) {
      this.iframe.contentWindow.postMessage(data, '*');
    }
  }

  // Export시 호출되는 메서드
  async getManuscriptForExport() {
    // iframe에 현재 원고 요청
    if (this.iframe && this.iframe.contentWindow) {
      return new Promise((resolve) => {
        // 일회성 리스너 설정
        const listener = (event) => {
          if (event.data.type === 'MANUSCRIPT_EXPORT') {
            window.removeEventListener('message', listener);
            resolve(event.data.content);
          }
        };
        window.addEventListener('message', listener);
        
        // iframe에 export 요청
        this.sendMessageToIframe({ type: 'REQUEST_MANUSCRIPT_FOR_EXPORT' });
        
        // 타임아웃 설정 (5초)
        setTimeout(() => {
          window.removeEventListener('message', listener);
          resolve(this.manuscriptContent); // 저장된 내용 반환
        }, 5000);
      });
    }
    return this.manuscriptContent;
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  window.manuscriptGen = new ManuscriptGenerator();
});