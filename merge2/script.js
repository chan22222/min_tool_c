// 모듈 import 제거 - 전역 객체로 접근

class PhotoClassifierApp {
  constructor() {
    this.categoryManager = new window.CategoryManager();
    this.stateManager = new window.StateManager(this.categoryManager);
    
    // 전역 상태 관리 (전역 네임스페이스 오염 최소화)
    this.initializeGlobalState();
    
    // 이벤트 리스너 정리를 위한 배열
    this.eventListeners = [];
    
    // 메모리 정리 타이머
    this.memoryCleanupInterval = null;
    
    // 업로드 최적화 옵션들 (모든 기능 기본 활성화)
    window.uploadOptimizations = {
      batch: localStorage.getItem('uploadOptimizeBatch') !== 'false', // 기본값 ON
      duplicate: localStorage.getItem('uploadOptimizeDuplicate') !== 'false', // 기본값 ON
      memory: localStorage.getItem('uploadOptimizeMemory') !== 'false', // 기본값 ON
      resize: true, // 항상 활성화 (비활성화 불가)
      resizePixels: parseInt(localStorage.getItem('uploadResizePixels') || '1200'), // 기본값 1200px
      batchSize: parseInt(localStorage.getItem('uploadBatchSize') || '10') // 기본값 10개
    };
    
    // 자동저장 관련 변수
    this.autoSaveInterval = null;
    this.autoSaveTime = parseInt(localStorage.getItem('autoSaveTime') || '0'); // 기본값 비활성화
    this.lastAutoSave = Date.now();
    this.currentDocumentName = null; // 항상 빈 프로젝트로 시작 (이전: localStorage.getItem('currentDocumentName') || null)
    this.isAutoSaving = false; // 자동저장 진행 중 플래그
    this.lastSaveHash = null; // 마지막 저장된 데이터의 해시값 (변경 감지용)
    
    this.init();
  }

  // 전역 상태 초기화
  initializeGlobalState() {
    window.selectedImages = new Set();
    window.imageHashes = new Map();
    window.thumbnailSize = 100;
    window.isExporting = false;
    window.isDarkMode = localStorage.getItem('darkMode') === 'true';
    window.previewCountVisible = localStorage.getItem('previewCountVisible') !== 'false'; // 기본값 ON
    window.zoomEnabled = localStorage.getItem('zoomEnabled') !== 'false'; // 기본값 ON
  }

  init() {
    this.applyTheme();
    this.applyPreviewCountVisibility();
    this.applyZoomToggle();
    this.applyUploadOptimizations();
    this.stateManager.loadSettings();
    this.categoryManager.loadSettings();
    this.createControlPanel();
    this.setupEventListeners();
    this.startAutoSave();
    this.setupBeforeUnload();
    this.updateCurrentDocumentDisplay();
    this.loadLastSession();
    this.startMemoryCleanup();
  }

  // 메모리 정리 시작
  startMemoryCleanup() {
    // 5분마다 메모리 정리 실행
    this.memoryCleanupInterval = setInterval(() => {
      this.performMemoryCleanup();
    }, 300000); // 5분
  }

  // 메모리 정리 수행
  performMemoryCleanup() {
    try {
      // ImageHash 맵 크기 제한 (최대 1000개)
      if (window.imageHashes && window.imageHashes.size > 1000) {
        const entries = Array.from(window.imageHashes.entries());
        window.imageHashes.clear();
        // 최근 500개만 유지
        entries.slice(-500).forEach(([key, value]) => {
          window.imageHashes.set(key, value);
        });
        console.log('메모리 정리: imageHashes 크기 제한 적용');
      }

      // 가비지 컬렉션 힌트
      if (window.gc && typeof window.gc === 'function') {
        window.gc();
      }
    } catch (error) {
      console.warn('메모리 정리 중 오류:', error);
    }
  }

  // 애플리케이션 정리 (페이지 언로드 시)
  cleanup() {
    try {
      // 인터벌 정리
      this.stopAutoSave(); // 자동저장 정지
      if (this.memoryCleanupInterval) {
        clearInterval(this.memoryCleanupInterval);
      }

      // 이벤트 리스너 정리
      this.eventListeners.forEach(({ element, event, handler }) => {
        if (element && element.removeEventListener) {
          element.removeEventListener(event, handler);
        }
      });

      // 객체 참조 정리
      if (this.stateManager && this.stateManager.destroy) {
        this.stateManager.destroy();
      }

      if (this.categoryManager && this.categoryManager.cleanup) {
        this.categoryManager.cleanup();
      }
      
      console.log('애플리케이션 정리 완료');
    } catch (error) {
      console.error('애플리케이션 정리 중 오류:', error);
    }
  }

  applyTheme() {
    try {
      if (window.isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
          themeToggle.textContent = '☀️';
        } else {
          console.warn('themeToggle 요소를 찾을 수 없습니다.');
        }
      } else {
        document.documentElement.removeAttribute('data-theme');
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
          themeToggle.textContent = '🌙';
        } else {
          console.warn('themeToggle 요소를 찾을 수 없습니다.');
        }
      }
    } catch (error) {
      console.error('테마 적용 중 오류:', error);
    }
  }

  applyPreviewCountVisibility() {
    try {
      const popup = document.getElementById('preview-count-popup');
      const toggle = document.getElementById('previewCountToggle');
      
      if (popup) {
        if (window.previewCountVisible) {
          popup.style.display = 'block';
        } else {
          popup.style.display = 'none';
        }
      } else {
        console.warn('preview-count-popup 요소를 찾을 수 없습니다.');
      }
      
      if (toggle) {
        if (window.previewCountVisible) {
          toggle.style.background = '#28a745';
        } else {
          toggle.style.background = 'var(--button-bg)';
        }
      } else {
        console.warn('previewCountToggle 요소를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('미리보기 카운트 가시성 적용 중 오류:', error);
    }
  }

  applyZoomToggle() {
    try {
      const toggle = document.getElementById('zoomToggle');
      if (toggle) {
        if (window.zoomEnabled) {
          toggle.style.background = '#28a745';
        } else {
          toggle.style.background = 'var(--button-bg)';
        }
      } else {
        console.warn('zoomToggle 요소를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('줌 토글 적용 중 오류:', error);
    }
  }

  applyUploadOptimizations() {
    // 각 체크박스 상태를 설정
    const checkboxes = {
      batch: document.getElementById('optimizeBatch'),
      duplicate: document.getElementById('optimizeDuplicate'),
      memory: document.getElementById('optimizeMemory')
    };
    
    // 툴팁 텍스트 설정
    const tooltips = {
      batch: `여러 파일을 안정적으로 순차 업로드하여 메모리 사용량을 최소화합니다 (현재 ${window.uploadOptimizations.batchSize}개씩 처리)`,
      duplicate: '동일한 이미지의 중복 업로드를 방지하여 저장 공간을 절약합니다 (원본 파일 기준)',
      memory: '대용량 파일 처리 시 메모리 사용량을 최소화하여 안정성을 높입니다 (압축 처리와 연동)'
    };
    
    Object.keys(checkboxes).forEach(key => {
      if (checkboxes[key]) {
        checkboxes[key].checked = window.uploadOptimizations[key];
        
        // 라벨에 툴팁 데이터 설정
        const label = checkboxes[key].nextElementSibling;
        if (label && label.classList.contains('optimization-label')) {
          label.setAttribute('data-tooltip', tooltips[key]);
        }
      }
    });
    
    // 배치 크기 셀렉트 초기화
    const batchSizeSelect = document.getElementById('batchSizeSelect');
    if (batchSizeSelect) {
      batchSizeSelect.value = window.uploadOptimizations.batchSize.toString();
    }
  }

  setupUploadOptimizations() {
    const checkboxes = {
      batch: document.getElementById('optimizeBatch'),
      duplicate: document.getElementById('optimizeDuplicate'),
      memory: document.getElementById('optimizeMemory')
    };
    
    const resizePixelSelect = document.getElementById('resizePixelSelect');
    const batchSizeSelect = document.getElementById('batchSizeSelect');
    
    Object.keys(checkboxes).forEach(key => {
      if (checkboxes[key]) {
        checkboxes[key].addEventListener('change', (e) => {
          window.uploadOptimizations[key] = e.target.checked;
          localStorage.setItem(`uploadOptimize${key.charAt(0).toUpperCase() + key.slice(1)}`, e.target.checked);
          
          const optionName = {
            batch: '배치 처리',
            duplicate: '중복 파일 감지',
            memory: '메모리 최적화'
          }[key];
          
          window.Utils.showProcessingMessage(
            `${optionName}가 ${e.target.checked ? '활성화' : '비활성화'}되었습니다.`
          );
          
          // 배치 처리 활성화/비활성화 시 툴팁 업데이트
          if (key === 'batch') {
            this.updateBatchTooltip();
          }
        });
      }
    });
    
    // 리사이징 픽셀 설정
    if (resizePixelSelect) {
      resizePixelSelect.value = window.uploadOptimizations.resizePixels.toString();
      resizePixelSelect.addEventListener('change', (e) => {
        window.uploadOptimizations.resizePixels = parseInt(e.target.value);
        localStorage.setItem('uploadResizePixels', e.target.value);
        window.Utils.showProcessingMessage(`업로드 리사이징이 ${e.target.value}px로 설정되었습니다.`);
      });
    }
    
    // 배치 크기 설정
    if (batchSizeSelect) {
      batchSizeSelect.value = window.uploadOptimizations.batchSize.toString();
      batchSizeSelect.addEventListener('change', (e) => {
        window.uploadOptimizations.batchSize = parseInt(e.target.value);
        localStorage.setItem('uploadBatchSize', e.target.value);
        window.Utils.showProcessingMessage(`배치 크기가 ${e.target.value}개로 설정되었습니다.`);
        this.updateBatchTooltip();
      });
    }
  }

  // 배치 처리 툴팁 업데이트
  updateBatchTooltip() {
    const batchLabel = document.querySelector('label[for="optimizeBatch"]');
    if (batchLabel) {
      batchLabel.setAttribute('data-tooltip', 
        `여러 파일을 안정적으로 순차 업로드하여 메모리 사용량을 최소화합니다 (현재 ${window.uploadOptimizations.batchSize}개씩 처리)`
      );
    }
  }



  setupEventListeners() {
    // 테마 토글
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        window.isDarkMode = !window.isDarkMode;
        localStorage.setItem('darkMode', window.isDarkMode);
        this.applyTheme();
      });
    }

    // 미리보기 현황 토글
    const previewCountToggle = document.getElementById('previewCountToggle');
    if (previewCountToggle) {
      previewCountToggle.addEventListener('click', () => {
        window.previewCountVisible = !window.previewCountVisible;
        localStorage.setItem('previewCountVisible', window.previewCountVisible);
        this.applyPreviewCountVisibility();
      });
    }

    // 스크롤 버튼 이벤트 리스너 추가
    const scrollToTop = document.getElementById('scrollToTop');
    const scrollToBottom = document.getElementById('scrollToBottom');
    
    if (scrollToTop) {
      scrollToTop.addEventListener('click', () => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    }
    
    if (scrollToBottom) {
      scrollToBottom.addEventListener('click', () => {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth'
        });
      });
    }

    // 사진 확대 토글
    const zoomToggle = document.getElementById('zoomToggle');
    if (zoomToggle) {
      zoomToggle.addEventListener('click', () => {
        window.zoomEnabled = !window.zoomEnabled;
        localStorage.setItem('zoomEnabled', window.zoomEnabled);
        this.applyZoomToggle();
      });
    }

    // 메뉴 탭 토글
    const menuTab = document.getElementById('menuTab');
    const menuDropdown = document.getElementById('menuDropdown');
    if (menuTab && menuDropdown) {
      menuTab.addEventListener('click', () => {
        menuDropdown.classList.toggle('show');
      });
      
      // 메뉴 외부 클릭 시 닫기
      document.addEventListener('click', (e) => {
        if (!menuTab.contains(e.target) && !menuDropdown.contains(e.target)) {
          menuDropdown.classList.remove('show');
        }
      });
    }

    // 확정 버튼
    const finalizeBtn = document.getElementById("finalizeBtn");
    if (finalizeBtn) {
      finalizeBtn.addEventListener('click', () => this.finalizeImages());
    }

    // Export 버튼
    const exportBtn = document.getElementById("exportBtn");
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportImages());
    }

    // 원고 작성기 토글 이벤트 리스너
    const manuscriptToggle = document.getElementById("manuscriptToggle");
    if (manuscriptToggle) {
      manuscriptToggle.addEventListener('change', async () => {
        if (manuscriptToggle.checked) {
          console.log('원고/파일리스트 토글 ON - 파일 업로드 시작');
          await this.uploadManuscriptFiles();
        }
      });
    }

    const AIManuscriptToggle = document.getElementById("AIManuscriptToggle");
    if (AIManuscriptToggle) {
      AIManuscriptToggle.addEventListener('change', async () => {
        if (AIManuscriptToggle.checked) {
          console.log('AI 원고 토글 ON - 파일 업로드 시작');
          await this.uploadManuscriptFiles();
        }
      });
    }

    // Export 설정 이벤트 (초기화 시에는 호출하지 않음)
    // this.setupExportSettings();

    // 업로드 최적화 옵션들
    this.setupUploadOptimizations();

    // iframe과의 메시지 통신 설정
    window.addEventListener('message', (event) => {
      if (event.data.type === 'REQUEST_MENU_IMAGES') {
        // 메뉴와 이미지 불러오기 요청 처리
        this.loadMenuAndImages();
      }
    });

    // 이미지 호버 확대
    document.addEventListener('mouseover', e => {
      if (window.zoomEnabled && e.target.tagName === 'IMG' && e.target.classList.contains('preview-img')) {
        const zoom = document.getElementById('zoom-preview');
        const zoomCategory = document.getElementById('zoom-category');
        const previewPopup = document.getElementById('preview-count-popup');
        
        // 이미지 크기 미리 확인하여 위젯 크기 설정
        const aspectRatio = e.target.naturalWidth / e.target.naturalHeight;
        
        // 가로 사진인 경우 위젯 크기 조절
        if (aspectRatio > 1.2) { // 가로 사진
          if (window.innerWidth > 768) {
            zoom.style.maxWidth = '300px';
            zoom.style.maxHeight = '400px';
          } else {
            zoom.style.maxWidth = '220px';
            zoom.style.maxHeight = '300px';
          }
        } else { // 세로 사진 또는 정사각형
          if (window.innerWidth > 768) {
            zoom.style.maxWidth = '420px';
            zoom.style.maxHeight = '520px';
          } else {
            zoom.style.maxWidth = '300px';
            zoom.style.maxHeight = '380px';
          }
        }
        
        zoom.style.display = 'block';
        zoom.querySelector('img').src = e.target.src;
        
        const category = e.target.dataset.category || '알 수 없음';
        const exportNumber = e.target.dataset.exportNumber;
        
        let displayText = category;
        if (exportNumber) {
          displayText = `#${exportNumber} - ${displayText}`;
        }
        
        zoomCategory.textContent = displayText;
      }
    });

    // 사진 확대 위젯에 마우스가 올라갈 때만 숨기기
    document.addEventListener('mouseover', e => {
      const zoom = document.getElementById('zoom-preview');
      
      if (e.target.closest('#zoom-preview')) {
        if (zoom && zoom.style.display === 'block') {
          zoom.style.display = 'none';
        }
      }
    });

    // 미리보기 현황 위젯에 마우스가 올라갈 때만 숨기기
    document.addEventListener('mouseover', e => {
      const previewPopup = document.getElementById('preview-count-popup');
      
      if (e.target.closest('#preview-count-popup')) {
        if (previewPopup && window.previewCountVisible) {
          previewPopup.style.display = 'none';
        }
      }
    });

    // 미리보기 현황 위젯에서 마우스가 벗어날 때 복원
    document.addEventListener('mouseout', e => {
      const previewPopup = document.getElementById('preview-count-popup');
      
      if (e.target.closest('#preview-count-popup') && window.previewCountVisible) {
        // 약간의 지연을 두어 마우스가 완전히 벗어났는지 확인
        setTimeout(() => {
          if (window.previewCountVisible) {
            previewPopup.style.display = 'block';
          }
        }, 100);
      }
    });

    document.addEventListener('mouseout', e => {
      if (window.zoomEnabled && e.target.tagName === 'IMG' && e.target.classList.contains('preview-img')) {
        const zoom = document.getElementById('zoom-preview');
        const previewPopup = document.getElementById('preview-count-popup');
        
        zoom.style.display = 'none';
        
        // 위젯 크기 초기화
        zoom.style.maxWidth = '';
        zoom.style.maxHeight = '';
        
        // 미리보기 현황 팝업을 원래 위치로 복원
        if (window.previewCountVisible && previewPopup) {
          previewPopup.style.display = 'block';
        }
      }
    });

    // 확대된 이미지는 우상단에 고정되므로 마우스 이동 시 위치 조정 불필요
  }

  createControlPanel() {
    const controlPanel = document.createElement("div");
    controlPanel.className = "control-panel";
    
    controlPanel.innerHTML = `
      <h3 style="margin-top:0; color:var(--button-bg);">🎛️ 컨트롤 패널</h3>
      
      <div class="control-section">
        <h4>🔧 표시 설정</h4>
        <div style="margin-bottom:10px;">
          <label><strong>썸네일 크기:</strong></label>
          <input type="range" id="sizeSlider" min="50" max="200" value="100" style="margin:0 10px;">
          <span id="sizeValue">100px</span>
        </div>
      </div>

      <div class="control-section">
        <h4>💾 저장/불러오기</h4>
        <div style="margin-bottom:15px;">
          <input type="text" id="stateName" placeholder="저장할 이름 입력" style="width:200px; margin-right:10px;">
          <button id="saveState" style="background:#28a745;">💾 저장</button>
        </div>
        <div style="margin-bottom:10px;">
          <button id="toggleStatesList" style="background:#6c757d;">📋 저장된 상태 목록</button>
        </div>
        <div id="savedStatesList" style="display:none; margin-top:10px; padding:10px; background:var(--bg-secondary); border-radius:5px; max-height:400px; overflow-y:auto;">
          <!-- 저장된 상태들이 여기에 표시됩니다 -->
        </div>
        
        <div style="margin-top:15px; padding:10px; background:var(--bg-secondary); border-radius:5px;">
          <h5 style="margin:0 0 10px 0; color:var(--button-bg);">🔄 자동저장 설정</h5>
          <div style="margin-bottom:10px;">
            <label><strong>자동저장 간격:</strong></label>
            <select id="autoSaveInterval" style="margin-left:10px; padding:5px;">
              <option value="0" selected>비활성화</option>
              <option value="30000">30초</option>
              <option value="60000">1분</option>
              <option value="180000">3분</option>
              <option value="300000">5분</option>
              <option value="600000">10분</option>
              <option value="1800000">30분</option>
              <option value="3600000">1시간</option>
            </select>
          </div>
          <div style="margin-bottom:10px; padding:8px; background:#fff3cd; border:1px solid #ffc107; border-radius:4px;">
            <span style="color:#dc3545; font-size:11px; font-weight:bold;">⚠️ 경고:</span>
            <span style="color:#856404; font-size:11px;">자동저장 기능은 SQL 버전으로 변경되며 2명 이상이 문서를 편집할 경우 충돌 확률이 매우 높아 비활성화를 권장합니다.</span>
          </div>
          <div style="margin-bottom:10px; font-size:12px; color:#666;">
            마지막 자동저장: <span id="lastAutoSave">-</span>
          </div>
          <div style="font-size:12px; color:#666;">
            마지막 편집문서: <span id="currentDocument" style="color:#007bff; font-weight:bold;">새 문서 (마지막 작업내역)</span>
          </div>
          <div style="margin-top:10px; display:flex; gap:5px;">
            <button id="manualAutoSave" style="background:#28a745; font-size:11px; padding:4px 8px;">💾 수동저장</button>
            <button id="checkAutoSaveStatus" style="background:#17a2b8; font-size:11px; padding:4px 8px;">🔍 저장상태 확인</button>
          </div>
        </div>
      </div>
      
      <div class="control-section">
        <h4>⚡ 배치 작업</h4>
        <div class="tooltip">
          <button id="loadAllBtn" style="background:#17a2b8; margin-right:10px;">🔄 전체 불러오기</button>
          <span class="tooltiptext">업로드된 모든 카테고리의 미리보기를 현재 설정된 수만큼 불러옵니다</span>
        </div>
        
        <div class="tooltip">
          <button id="fillEmptyBtn" style="background:#6f42c1; margin-right:10px;">📋 빈 카테고리 채우기</button>
          <span class="tooltiptext">사진은 업로드되어 있지만 미리보기가 없는 카테고리만 불러옵니다</span>
        </div>
        
        <div class="tooltip">
          <button id="clearAllBtn" style="background:#dc3545;">🗑️ 미리보기 초기화</button>
          <span class="tooltiptext">전체 미리보기를 삭제합니다 (업로드된 파일은 유지)</span>
        </div>
      </div>
      
      <div style="margin-top:15px;">
        <small style="color:#6c757d;">선택된 이미지: <span id="selectedCount">0</span>개</small>
      </div>
    `;
    
    // h1 태그 다음에 컨트롤 패널 삽입
    const h1Element = document.querySelector('h1');
    if (h1Element) {
      document.body.insertBefore(controlPanel, h1Element.nextSibling);
    } else {
      // fallback: categories div 앞에 삽입
      const categories = document.getElementById('categories');
      if (categories) {
        document.body.insertBefore(controlPanel, categories);
      } else {
        // 최후의 fallback: body 끝에 추가
        document.body.appendChild(controlPanel);
      }
    }
    
    // 업로드 최적화 옵션을 컨트롤 패널 바로 밑에 추가
    const optimizationPanel = document.createElement("div");
    optimizationPanel.className = "upload-optimization";
    optimizationPanel.innerHTML = `
      <div class="optimization-options">
        <div class="optimization-item">
          <input type="checkbox" id="optimizeBatch" checked>
          <label for="optimizeBatch" class="optimization-label" data-tooltip="여러 파일을 안정적으로 순차 업로드하여 메모리 사용량을 최소화합니다">배치 처리</label>
          <select id="batchSizeSelect" style="margin-left: 10px; padding: 2px 5px;">
            <option value="3">3개씩</option>
            <option value="5">5개씩</option>
            <option value="8">8개씩</option>
            <option value="10" selected>10개씩</option>
            <option value="15">15개씩</option>
            <option value="20">20개씩</option>
            <option value="25">25개씩</option>
            <option value="30">30개씩</option>
            <option value="40">40개씩</option>
            <option value="50">50개씩</option>
          </select>
        </div>
        <div class="optimization-item">
          <input type="checkbox" id="optimizeDuplicate" checked>
          <label for="optimizeDuplicate" class="optimization-label" data-tooltip="동일한 이미지의 중복 업로드를 방지하여 저장 공간을 절약합니다">중복 감지</label>
        </div>
        <div class="optimization-item">
          <input type="checkbox" id="optimizeMemory" checked>
          <label for="optimizeMemory" class="optimization-label" data-tooltip="대용량 파일 처리 시 메모리 사용량을 최소화하여 안정성을 높입니다">메모리 최적화</label>
        </div>
        <div class="optimization-item">
          <input type="checkbox" id="optimizeResize" checked disabled>
          <label for="optimizeResize" class="optimization-label" data-tooltip="업로드 시 이미지를 지정한 크기로 자동 리사이징합니다 (필수 기능)">이미지 리사이징 (필수)</label>
          <select id="resizePixelSelect" style="margin-left: 10px; padding: 2px 5px;">
            <option value="1200">1200px</option>
            <option value="1800">1800px</option>
            <option value="2400">2400px</option>
            <option value="3000">3000px</option>
          </select>
        </div>
      </div>
    `;
    
    // 컨트롤 패널 바로 다음에 삽입
    document.body.insertBefore(optimizationPanel, controlPanel.nextSibling);
    

    
    this.setupControlPanelEvents();
  }

  setupControlPanelEvents() {
    const sizeSlider = document.getElementById("sizeSlider");
    const sizeValue = document.getElementById("sizeValue");
    
    sizeSlider.addEventListener("input", (e) => {
      window.thumbnailSize = parseInt(e.target.value);
      sizeValue.textContent = window.thumbnailSize + "px";
      this.stateManager.updateThumbnailSize();
      this.stateManager.saveSettings();
      this.performAutoSave();
    });
    
    // 자동저장 간격 설정 - localStorage 값 또는 기본값(0) 사용
    const autoSaveInterval = document.getElementById("autoSaveInterval");
    if (autoSaveInterval) {
      autoSaveInterval.value = this.autoSaveTime.toString();
    }
    autoSaveInterval.addEventListener("change", (e) => {
      this.autoSaveTime = parseInt(e.target.value);
      localStorage.setItem('autoSaveTime', this.autoSaveTime.toString());
      this.restartAutoSave();
      
      // 비활성화 처리
      if (this.autoSaveTime === 0) {
        this.stopAutoSave();
        window.Utils.showProcessingMessage('자동저장이 비활성화되었습니다.');
      } else {
        window.Utils.showProcessingMessage(`자동저장 간격이 ${this.autoSaveTime/1000}초로 변경되었습니다.`);
      }
    });
    
    document.getElementById("saveState").addEventListener("click", async () => {
      // 자동저장이 진행 중인 경우 사용자에게 알림
      if (this.isAutoSaving) {
        if (!confirm('현재 자동저장이 진행 중입니다. 수동저장을 계속하시겠습니까?')) {
          return;
        }
      }
      await this.stateManager.saveCurrentState();
    });
    document.getElementById("manualAutoSave").addEventListener("click", async () => {
      // 자동저장이 진행 중인 경우 사용자에게 알림
      if (this.isAutoSaving) {
        if (!confirm('현재 자동저장이 진행 중입니다. 수동저장을 계속하시겠습니까?')) {
          return;
        }
      }
      await this.stateManager.saveCurrentState();
    });
    document.getElementById("checkAutoSaveStatus").addEventListener("click", () => this.checkAutoSaveStatus());
    
    // 저장 입력폼에 현재 문서명 자동 입력
    const stateNameInput = document.getElementById("stateName");
    if (stateNameInput) {
      stateNameInput.addEventListener('focus', () => {
        if (this.currentDocumentName && !stateNameInput.value) {
          stateNameInput.value = this.currentDocumentName;
        }
      });
    }
    document.getElementById("toggleStatesList").addEventListener("click", () => this.toggleStatesList());
    document.getElementById("loadAllBtn").addEventListener("click", () => this.loadAllCategories());
    document.getElementById("fillEmptyBtn").addEventListener("click", () => this.fillEmptyCategories());
    document.getElementById("clearAllBtn").addEventListener("click", () => this.clearAllCategories());
  }

  // 전체 불러오기
  async loadAllCategories() {
    if (confirm("모든 카테고리를 자동으로 불러오시겠습니까?")) {
      const loadAllBtn = document.getElementById("loadAllBtn");
      window.Utils.setButtonLoading(loadAllBtn, true);
      window.Utils.showProcessingMessage('모든 카테고리를 불러오는 중...');
      
      let loadedCount = 0;
      
      for (const cat of this.categoryManager.categories) {
        if (cat.enabled && this.categoryManager.categoryData[cat.name] && this.categoryManager.categoryData[cat.name].files.length > 0) {
          const wrapper = document.querySelector(`[data-category="${cat.name}"]`);
          if (wrapper) {
            const loadBtn = wrapper.querySelector('.load-btn');
            if (loadBtn && !loadBtn.disabled) {
              await new Promise(resolve => {
                const originalOnclick = loadBtn.onclick;
                loadBtn.onclick = async () => {
                  await originalOnclick();
                  loadedCount++;
                  resolve();
                };
                loadBtn.click();
                loadBtn.onclick = originalOnclick;
              });
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
        }
      }
      
      window.Utils.setButtonLoading(loadAllBtn, false);
      window.Utils.showProcessingMessage(`${loadedCount}개 카테고리 불러오기가 완료되었습니다!`);
    }
  }

  // 빈 카테고리 채우기
  async fillEmptyCategories() {
    const fillBtn = document.getElementById("fillEmptyBtn");
    window.Utils.setButtonLoading(fillBtn, true);
    window.Utils.showProcessingMessage('빈 카테고리를 채우는 중...');
    
    let filledCount = 0;
    
    for (const cat of this.categoryManager.categories) {
      if (cat.enabled &&
          this.categoryManager.categoryData[cat.name] && 
          this.categoryManager.categoryData[cat.name].files.length > 0 && 
          this.categoryManager.categoryData[cat.name].previews.length === 0) {
        const wrapper = document.querySelector(`[data-category="${cat.name}"]`);
        if (wrapper) {
          const loadBtn = wrapper.querySelector('.load-btn');
          if (loadBtn && !loadBtn.disabled) {
            await new Promise(resolve => {
              const originalOnclick = loadBtn.onclick;
              loadBtn.onclick = async () => {
                await originalOnclick();
                filledCount++;
                resolve();
              };
              loadBtn.click();
              loadBtn.onclick = originalOnclick;
            });
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }
    }
    
    window.Utils.setButtonLoading(fillBtn, false);
    window.Utils.showProcessingMessage(`${filledCount}개의 빈 카테고리를 채웠습니다!`);
  }

  // 미리보기 초기화
  clearAllCategories() {
    if (confirm("모든 미리보기를 초기화하시겠습니까? (업로드된 파일은 유지됩니다)")) {
      const clearBtn = document.getElementById("clearAllBtn");
      window.Utils.setButtonLoading(clearBtn, true);
      window.Utils.showProcessingMessage('미리보기 초기화 중...');
      
      Object.keys(this.categoryManager.categoryData).forEach(cat => {
        if (this.categoryManager.categoryData[cat].previews) {
          this.categoryManager.categoryData[cat].previews.forEach(file => {
            window.selectedImages.delete(window.Utils.getImageKey(file));
          });
        }
        
        this.categoryManager.categoryData[cat].previews = [];
        const container = document.querySelector(`[data-category="${cat}"] .preview-container`);
        if (container) container.innerHTML = "";
        
        // 미리보기 수는 원래 값으로 유지 (0으로 설정하지 않음)
        const wrapper = document.querySelector(`[data-category="${cat}"]`);
        if (wrapper) {
          const previewInput = wrapper.querySelector("input[type=number]");
          if (previewInput) {
            // 미리보기 수를 0으로 설정하지 않고 원래 값 유지
            // 탭도 닫지 않음
          }
        }
      });
      
      this.categoryManager.updateSelectedCount();
      this.categoryManager.updatePreviewCountPopup();
      
      window.Utils.setButtonLoading(clearBtn, false);
      window.Utils.showProcessingMessage('모든 미리보기가 초기화되었습니다!');
    }
  }

  // 페이지 전체 초기화 (미리보기, 유저 데이터 모두)
  async resetEntirePage() {
    if (confirm("페이지 전체를 초기화하시겠습니까?\n\n모든 데이터가 삭제됩니다:\n- 업로드된 파일\n- 미리보기\n- 카테고리 설정\n- 유저 데이터\n- 저장된 프로젝트 목록\n- 자동저장 설정")) {
      try {
        // IndexedDB의 모든 저장된 상태 삭제 (먼저 실행)
        if (window.stateManager) {
          await window.stateManager.clearAllSavedStates();
        }
        
        // 모든 데이터 초기화
        this.categoryManager.categoryData = {};
        this.categoryManager.categories = [];
        window.selectedImages = new Set();
        window.imageHashes = new Map();
        
        // 현재 프로젝트 상태 초기화
        this.currentDocumentName = null;
        localStorage.removeItem('currentDocumentName');
        
        // 자동저장 데이터 삭제
        localStorage.removeItem('photoClassifierAutoSave');
        
        // 모든 localStorage 데이터 삭제 (설정 포함)
        localStorage.clear();
        
        // UI 초기화
        this.categoryManager.renderCategories();
        this.categoryManager.updateSelectedCount();
        this.categoryManager.updatePreviewCountPopup();
        
        // 새 프로젝트 상태로 복귀
        this.showNewProjectMessage();
        
        // 최종 정렬 컨테이너 숨기기
        const finalPreviewContainer = document.getElementById("finalPreviewContainer");
        if (finalPreviewContainer) {
          finalPreviewContainer.style.display = "none";
        }
        
        // 현재 문서 표시 초기화
        this.updateCurrentDocumentDisplay();
        
        // 저장된 상태 목록 즉시 업데이트
        if (window.stateManager) {
          // 초기화 후에는 항상 프로젝트 목록을 보여줘야 함
          window.stateManager.forceEmptyState = false;
          await window.stateManager.loadSavedStatesList();
        }
        
        window.Utils.showProcessingMessage('페이지가 완전히 초기화되었습니다!');
      } catch (error) {
        console.error('페이지 초기화 중 오류:', error);
        alert('페이지 초기화 중 오류가 발생했습니다.');
      }
    }
  }

  // SQL 데이터 내보내기
  async exportSQLData() {
    try {
      window.Utils.showProcessingMessage('SQL 데이터를 내보내는 중...');
      
      // API 호출하여 데이터 내보내기
      const response = await fetch('api/data_management.php?action=export');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Blob으로 변환하여 다운로드
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `photo_classifier_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      window.Utils.showProcessingMessage('SQL 데이터 내보내기 완료!');
    } catch (error) {
      console.error('SQL 데이터 내보내기 오류:', error);
      alert('SQL 데이터 내보내기 중 오류가 발생했습니다:\n' + error.message);
    }
  }

  // SQL 데이터 가져오기
  async importSQLData() {
    try {
      // 파일 선택 input 생성
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
          window.Utils.showProcessingMessage('SQL 데이터를 가져오는 중...');
          
          // 파일 읽기
          const text = await file.text();
          
          // API 호출하여 데이터 가져오기
          const response = await fetch('api/data_management.php?action=import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data: text })
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const result = await response.json();
          
          if (result.success) {
            window.Utils.showProcessingMessage(
              `가져오기 완료!\n` +
              `새 프로젝트: ${result.data.imported_projects}개\n` +
              `새 이미지: ${result.data.imported_images}개\n` +
              `중복 프로젝트: ${result.data.skipped_projects}개\n` +
              `중복 이미지: ${result.data.skipped_images}개`
            );
            
            // 프로젝트 목록 새로고침
            if (window.stateManager) {
              await window.stateManager.loadSavedStatesList();
            }
          } else {
            throw new Error(result.message || 'Import failed');
          }
        } catch (error) {
          console.error('SQL 데이터 가져오기 오류:', error);
          alert('SQL 데이터 가져오기 중 오류가 발생했습니다:\n' + error.message);
        }
      };
      
      input.click();
    } catch (error) {
      console.error('파일 선택 오류:', error);
      alert('파일 선택 중 오류가 발생했습니다.');
    }
  }

  // SQL 데이터 초기화
  async resetSQLData() {
    if (confirm(
      "SQL 데이터베이스를 초기화하시겠습니까?\n\n" +
      "⚠️ 경고: 이 작업은 되돌릴 수 없습니다!\n\n" +
      "삭제될 항목:\n" +
      "• 모든 프로젝트 데이터\n" +
      "• 모든 이미지 메타데이터\n" +
      "• 업로드된 모든 파일\n\n" +
      "계속하시겠습니까?"
    )) {
      if (confirm("정말 확실합니까? 모든 SQL 데이터가 영구적으로 삭제됩니다!")) {
        try {
          window.Utils.showProcessingMessage('SQL 데이터를 초기화하는 중...');
          
          // API 호출하여 데이터 초기화
          const response = await fetch('api/data_management.php?action=reset', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            }
          });
          
          console.log('Response status:', response.status);
          console.log('Response headers:', response.headers);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}\nResponse: ${errorText}`);
          }
          
          const result = await response.json();
          console.log('Reset result:', result);
          
          if (result.success) {
            window.Utils.showProcessingMessage('SQL 데이터베이스가 완전히 초기화되었습니다!');
            
            // 현재 페이지도 초기화
            await this.resetEntirePage();
          } else {
            throw new Error(result.message || 'Reset failed');
          }
        } catch (error) {
          console.error('SQL 데이터 초기화 오류:', error);
          
          // 더 자세한 에러 메시지
          let errorMsg = 'SQL 데이터 초기화 중 오류가 발생했습니다:\n';
          if (error.message) {
            errorMsg += error.message;
          }
          errorMsg += '\n\n디버깅을 위해 다음 URL들을 확인해보세요:\n';
          errorMsg += '1. 에러 로그: ' + window.location.origin + '/merge2/api/debug_errors.php\n';
          errorMsg += '2. 테스트: ' + window.location.origin + '/merge2/api/test_reset.php\n';
          errorMsg += '3. DB 테스트: ' + window.location.origin + '/merge2/api/test_db.php';
          
          alert(errorMsg);
        }
      }
    }
  }

  // 전체 백업 내보내기 (SQL + 이미지)
  async exportFullBackup() {
    try {
      const confirmMessage = 
        "전체 백업을 생성하시겠습니까?\n\n" +
        "포함되는 내용:\n" +
        "• 모든 프로젝트 데이터\n" +
        "• 모든 이미지 파일\n" +
        "• 메타데이터 및 설정\n\n" +
        "⚠️ 이미지가 많으면 파일 크기가 클 수 있습니다.";
      
      if (!confirm(confirmMessage)) {
        return;
      }
      
      window.Utils.showProcessingMessage('전체 백업을 생성하는 중... (시간이 걸릴 수 있습니다)');
      
      // 직접 fetch를 사용하여 파일 다운로드
      const response = await fetch('api/data_export_full.php');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // 파일 다운로드 처리
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // 다운로드 링크 생성 및 클릭
      const a = document.createElement('a');
      a.href = url;
      a.download = `photo_classifier_full_backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.zip`;
      document.body.appendChild(a);
      a.click();
      
      // 정리
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      window.Utils.showProcessingMessage('전체 백업 다운로드가 완료되었습니다!');
      
    } catch (error) {
      console.error('전체 백업 내보내기 오류:', error);
      alert('전체 백업 내보내기 중 오류가 발생했습니다:\n' + error.message);
    }
  }

  // 전체 백업 가져오기 (SQL + 이미지)
  async importFullBackup() {
    try {
      const confirmMessage = 
        "전체 백업을 가져오시겠습니까?\n\n" +
        "복원되는 내용:\n" +
        "• 모든 프로젝트 데이터\n" +
        "• 모든 이미지 파일\n" +
        "• 메타데이터 및 설정\n\n" +
        "⚠️ 기존 데이터와 병합됩니다 (중복은 건너뜁니다)";
      
      if (!confirm(confirmMessage)) {
        return;
      }
      
      // 파일 선택 input 생성
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip';
      
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // 파일 크기 확인 (10GB 제한)
        const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
        if (file.size > maxSize) {
          alert(`파일 크기가 너무 큽니다.\n현재: ${(file.size / (1024*1024*1024)).toFixed(2)}GB\n최대: 10GB`);
          return;
        }
        
        // 대용량 파일 경고
        if (file.size > 1024 * 1024 * 1024) { // 1GB 이상
          const sizeGB = (file.size / (1024*1024*1024)).toFixed(2);
          if (!confirm(`대용량 파일 (${sizeGB}GB)을 업로드합니다.\n\n시간이 오래 걸릴 수 있습니다.\n계속하시겠습니까?`)) {
            return;
          }
        }
        
        try {
          window.Utils.showProcessingMessage('전체 백업을 가져오는 중... (시간이 걸릴 수 있습니다)');
          
          // FormData로 파일 전송
          const formData = new FormData();
          formData.append('backup', file);
          
          // API 호출
          const response = await fetch('api/data_import_full.php', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const result = await response.json();
          
          if (result.success) {
            window.Utils.showProcessingMessage(
              `전체 백업 가져오기 완료!\n` +
              `• 새 프로젝트: ${result.data.imported_projects}개\n` +
              `• 업데이트된 프로젝트: ${result.data.updated_projects}개\n` +
              `• 이미지 메타데이터: ${result.data.imported_images}개\n` +
              `• 복사된 파일: ${result.data.copied_files}개\n` +
              `• 실패한 파일: ${result.data.failed_files}개`
            );
            
            // 프로젝트 목록 새로고침
            if (window.stateManager) {
              await window.stateManager.loadSavedStatesList();
            }
          } else {
            throw new Error(result.message || 'Import failed');
          }
        } catch (error) {
          console.error('전체 백업 가져오기 오류:', error);
          alert('전체 백업 가져오기 중 오류가 발생했습니다:\n' + error.message);
        }
      };
      
      input.click();
    } catch (error) {
      console.error('파일 선택 오류:', error);
      alert('파일 선택 중 오류가 발생했습니다.');
    }
  }

  // 확정 버튼 (최적화된 버전)
  async finalizeImages() {
    try {
      const finalizeBtn = document.getElementById("finalizeBtn");
      window.Utils.setButtonLoading(finalizeBtn, true);
      window.Utils.showProcessingMessage('최종 정렬을 생성하는 중...');
      window.Utils.showProgressBar(0);
    
    const finalContainer = document.getElementById("finalPreview");
    const finalPreviewWrapper = document.getElementById("finalPreviewContainer");
    finalPreviewWrapper.style.display = "block";
    finalContainer.innerHTML = "";
    
    // Export 설정 UI가 표시되도록 보장
    const exportSettings = finalPreviewWrapper.querySelector('.export-settings');
    if (exportSettings) {
      exportSettings.style.display = 'block';
    }

    let allImageData = [];
    let imageCounter = 1;
    
    // 활성화된 카테고리만 포함 (DOM 순서대로)
    const categoryElements = document.querySelectorAll('#categories .category');
    categoryElements.forEach(categoryElement => {
      const categoryName = categoryElement.getAttribute('data-category');
      const cat = this.categoryManager.categories.find(c => c.name === categoryName);
      
      if (cat && cat.enabled && this.categoryManager.categoryData[categoryName] && this.categoryManager.categoryData[categoryName].previews) {
        // 카테고리 내 이미지 순서도 반영 (DOM 순서대로)
        const container = categoryElement.querySelector('.preview-container');
        if (container) {
          const imgElements = Array.from(container.querySelectorAll('img.preview-img'));
          imgElements.forEach((img, domIndex) => {
            // DOM 순서를 완전히 신뢰하여 사용
            const fileIndex = domIndex;
            
            if (fileIndex < this.categoryManager.categoryData[categoryName].previews.length) {
              const file = this.categoryManager.categoryData[categoryName].previews[fileIndex];
              if (file) {
                allImageData.push({ 
                  file: file, 
                  category: categoryName,
                  exportNumber: imageCounter++
                });
              }
            }
          });
        }
      }
    });
    
    allImageData = allImageData.slice(0, 30);
    
    const totalImages = allImageData.length;
    let processedImages = 0;

    // 이미지를 배치로 처리
    const batchSize = Math.min(window.uploadOptimizations.batchSize, 10); // 최종 정렬은 최대 10개로 제한
    for (let i = 0; i < allImageData.length; i += batchSize) {
      const batch = allImageData.slice(i, i + batchSize);
      
      const imagePromises = batch.map(({ file, category, exportNumber }, index) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = e => {
            resolve({
              src: e.target.result,
              category: category,
              exportNumber: exportNumber,
              originalIndex: i + index
            });
          };
          reader.readAsDataURL(file);
        });
      });

      const results = await Promise.all(imagePromises);
      
      results.forEach(({ src, category, exportNumber }) => {
        const img = document.createElement("img");
        img.src = src;
        img.draggable = false;
        img.dataset.category = category;
        img.dataset.exportNumber = exportNumber;
        img.className = "preview-img";
        img.style.width = window.thumbnailSize + "px";
        img.style.height = window.thumbnailSize + "px";
        img.style.objectFit = "cover";
        
        finalContainer.appendChild(img);
        
        processedImages++;
        window.Utils.showProgressBar((processedImages / totalImages) * 100);
      });
      
      // UI 블로킹 방지
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // 최종 정렬에도 드래그 정렬 활성화
    const existingFinalSortable = finalContainer.sortableInstance;
    if (existingFinalSortable && existingFinalSortable.destroy) {
      existingFinalSortable.destroy();
    }
    
    const finalSortable = new Sortable(finalContainer, {
      animation: 150,
      ghostClass: 'drag-placeholder',
      onStart: (evt) => {
        console.log('finalPreview 드래그 시작:', evt.oldIndex);
      },
      onEnd: (evt) => {
        console.log('finalPreview 드래그 완료:', evt.oldIndex, '->', evt.newIndex);
        
        // 모든 이미지의 export 번호 다시 매기기
        const images = finalContainer.querySelectorAll('img');
        images.forEach((img, index) => {
          img.dataset.exportNumber = index + 1;
          // 이미지 오버레이의 번호도 업데이트
          const overlay = img.nextElementSibling;
          if (overlay && overlay.classList.contains('image-overlay')) {
            overlay.textContent = index + 1;
          }
        });
        
        console.log('finalPreview 번호 재정렬 완료');
      }
    });
    
    finalContainer.sortableInstance = finalSortable;
    
      window.Utils.hideProgressBar();
      window.Utils.setButtonLoading(finalizeBtn, false);
      window.Utils.showProcessingMessage('최종 정렬이 완료되었습니다!');
      
      // 원고 작성기 연동: finalizeBtn 클릭 시 파일 업로드
      await this.uploadManuscriptFiles();
      
      // 사진 개수에 따른 토글 자동 설정
      const totalImagesInFinal = allImageData.length;
      const manuscriptToggle = document.getElementById('manuscriptToggle');
      const videoToggle = document.getElementById('videoToggle');
      
      if (totalImagesInFinal > 20) {
        // 21장 이상: 원고/파일리스트 OFF, 동영상 ON
        if (manuscriptToggle) {
          manuscriptToggle.checked = false;
          console.log('21장 이상 - 원고 작성용 총합본과 파일리스트 OFF');
        }
        if (videoToggle) {
          videoToggle.checked = true;
          console.log('21장 이상 - 최적화 블로그용 동영상 ON');
        }
        window.Utils.showProcessingMessage(`${totalImagesInFinal}장 감지 - 블로그 최적화 모드로 설정되었습니다.`);
      } else {
        // 20장 이하: 원고/파일리스트 ON, 동영상 OFF
        if (manuscriptToggle) {
          manuscriptToggle.checked = true;
          console.log('20장 이하 - 원고 작성용 총합본과 파일리스트 ON');
        }
        if (videoToggle) {
          videoToggle.checked = false;
          console.log('20장 이하 - 최적화 블로그용 동영상 OFF');
        }
        window.Utils.showProcessingMessage(`${totalImagesInFinal}장 감지 - 원고 작성 모드로 설정되었습니다.`);
      }
      
      // Export 설정 초기화 (DOM이 준비된 후)
      setTimeout(() => {
        this.setupExportSettings();
        // 강제로 설정 새로고침 (브라우저 캐시 문제 방지)
        this.refreshExportSettings();
      }, 200);
    } catch (error) {
      console.error('최종 정렬 생성 중 오류:', error);
      window.Utils.hideProgressBar();
      window.Utils.setButtonLoading(finalizeBtn, false);
      window.Utils.showProcessingMessage('최종 정렬 생성 중 오류가 발생했습니다.');
    }
  }

  // 메뉴와 이미지 불러오기 함수
  async loadMenuAndImages() {
    try {
      console.log('메뉴와 이미지 불러오기 시작...');
      
      const finalContainer = document.getElementById("finalPreview");
      if (!finalContainer) {
        console.log('finalPreview가 없습니다.');
        return;
      }
      
      const imgs = finalContainer.querySelectorAll("img");
      if (imgs.length === 0) {
        console.log('불러올 이미지가 없습니다.');
        return;
      }
      
      // iframe 찾기
      const iframe = document.getElementById('ai-manuscript-iframe');
      if (!iframe || !iframe.contentWindow) {
        console.log('원고 작성기 iframe을 찾을 수 없습니다.');
        return;
      }
      
      // iframe 문서에서 요소 찾기
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      
      // 98_파일리스트.txt 생성 및 업로드
      const fileListContent = this.createFileList(imgs);
      if (fileListContent) {
        const fileListBlob = new Blob([fileListContent], { type: 'text/plain;charset=utf-8' });
        const fileListFile = new File([fileListBlob], '98_파일리스트.txt', { type: 'text/plain' });
        
        // iframe 내부의 ordered-menu-upload에 업로드
        const orderedMenuUpload = iframeDoc.getElementById('ordered-menu-upload');
        if (orderedMenuUpload) {
          const dt = new DataTransfer();
          dt.items.add(fileListFile);
          orderedMenuUpload.files = dt.files;
          
          // change 이벤트 발생
          const event = new Event('change', { bubbles: true });
          orderedMenuUpload.dispatchEvent(event);
          console.log('98_파일리스트.txt 업로드 완료');
        } else {
          console.log('ordered-menu-upload 요소를 찾을 수 없습니다.');
        }
      }
      
      // 99_총합본.jpg 생성 및 업로드
      const summaryBlob = await this.createSummaryImage(imgs);
      if (summaryBlob) {
        const mergedFile = new File([summaryBlob], '99_총합본.jpg', { type: 'image/jpeg' });
        
        // iframe 내부의 drop-zone에 업로드
        const dropZone = iframeDoc.getElementById('drop-zone');
        const imageUpload = iframeDoc.getElementById('image-upload');
        
        if (imageUpload) {
          // input file을 통한 업로드
          const dt = new DataTransfer();
          dt.items.add(mergedFile);
          imageUpload.files = dt.files;
          
          // change 이벤트 발생
          const event = new Event('change', { bubbles: true });
          imageUpload.dispatchEvent(event);
          console.log('99_총합본.jpg 업로드 완료');
        } else if (dropZone) {
          // drop 이벤트 시뮬레이션
          const dt = new DataTransfer();
          dt.items.add(mergedFile);
          
          const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt
          });
          dropZone.dispatchEvent(dropEvent);
          console.log('99_총합본.jpg 드롭 완료');
        } else {
          console.log('drop-zone 또는 image-upload 요소를 찾을 수 없습니다.');
        }
      }
      
      window.Utils.showProcessingMessage('메뉴와 이미지가 로드되었습니다.');
    } catch (error) {
      console.error('메뉴와 이미지 로드 중 오류:', error);
    }
  }

  // 원고 작성기 파일을 사진분류웹앱으로 업로드
  async uploadManuscriptFiles() {
    try {
      console.log('원고 작성기 파일 업로드 시작...');
      
      const finalContainer = document.getElementById("finalPreview");
      if (!finalContainer) {
        console.log('finalPreview가 없습니다.');
        return;
      }
      
      const imgs = finalContainer.querySelectorAll("img");
      if (imgs.length === 0) {
        console.log('업로드할 이미지가 없습니다.');
        return;
      }
      
      // iframe 찾기
      const iframe = document.getElementById('ai-manuscript-iframe');
      if (!iframe || !iframe.contentWindow) {
        console.log('원고 작성기 iframe을 찾을 수 없습니다.');
        return;
      }
      
      // iframe 문서에서 요소 찾기
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      
      // 98_파일리스트.txt 생성 및 업로드 - 비활성화
      /*
      const fileListContent = this.createFileList(imgs);
      if (fileListContent) {
        const fileListBlob = new Blob([fileListContent], { type: 'text/plain;charset=utf-8' });
        const fileListFile = new File([fileListBlob], '98_파일리스트.txt', { type: 'text/plain' });
        
        // iframe 내부의 ordered-menu-upload에 업로드
        const orderedMenuUpload = iframeDoc.getElementById('ordered-menu-upload');
        if (orderedMenuUpload) {
          const dt = new DataTransfer();
          dt.items.add(fileListFile);
          orderedMenuUpload.files = dt.files;
          
          // change 이벤트 발생
          const event = new Event('change', { bubbles: true });
          orderedMenuUpload.dispatchEvent(event);
          console.log('98_파일리스트.txt 업로드 완료');
        } else {
          console.log('ordered-menu-upload 요소를 찾을 수 없습니다.');
        }
      }
      */
      
      // 99_총합본.jpg 생성 및 업로드 - 비활성화
      /*
      const summaryBlob = await this.createSummaryImage(imgs);
      if (summaryBlob) {
        const mergedFile = new File([summaryBlob], '99_총합본.jpg', { type: 'image/jpeg' });
        
        // iframe 내부의 drop-zone에 업로드
        const dropZone = iframeDoc.getElementById('drop-zone');
        const imageUpload = iframeDoc.getElementById('image-upload');
        
        if (imageUpload) {
          // input file을 통한 업로드
          const dt = new DataTransfer();
          dt.items.add(mergedFile);
          imageUpload.files = dt.files;
          
          // change 이벤트 발생
          const event = new Event('change', { bubbles: true });
          imageUpload.dispatchEvent(event);
          console.log('99_총합본.jpg 업로드 완료');
        } else if (dropZone) {
          // drop 이벤트 시뮬레이션
          const dt = new DataTransfer();
          dt.items.add(mergedFile);
          
          const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt
          });
          dropZone.dispatchEvent(dropEvent);
          console.log('99_총합본.jpg 드롭 완료');
        } else {
          console.log('drop-zone 또는 image-upload 요소를 찾을 수 없습니다.');
        }
      }
      */
      
      window.Utils.showProcessingMessage('원고 작성기로 파일이 전송되었습니다.');
    } catch (error) {
      console.error('원고 작성기 파일 업로드 오류:', error);
    }
  }

  // 99_총합본.jpg 생성 함수
  async createSummaryImage(imgs) {
    return new Promise((resolve) => {
      try {
        // 이미지가 없는 경우 처리
        if (!imgs || imgs.length === 0) {
          resolve(null);
          return;
        }

        // Canvas 생성
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 설정
        const cols = 4; // 열 개수
        const imageSize = 300; // 각 이미지 크기
        const spacing = 10; // 이미지 간 간격
        const titleHeight = 40; // 제목 영역 높이
        const categoryLineHeight = 20; // 카테고리 텍스트 한 줄 높이
        const categoryPadding = 10; // 카테고리 텍스트 상하 패딩
        const maxCategoryLines = 3; // 카테고리 텍스트 최대 줄 수
        
        // 카테고리 텍스트 줄바꿈 처리 함수
        const wrapText = (text, maxWidth) => {
          const lines = [];
          let currentLine = '';
          
          // 임시 폰트 설정 (측정용)
          ctx.font = '12px Arial';
          
          // 쉼표나 특수문자로 분할
          const parts = text.split(/([,，、·\/\-\s]+)/);
          
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const testLine = currentLine + part;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine !== '') {
              lines.push(currentLine.trim());
              currentLine = part;
            } else {
              currentLine = testLine;
            }
          }
          
          if (currentLine !== '') {
            lines.push(currentLine.trim());
          }
          
          // 최대 줄 수 제한
          if (lines.length > maxCategoryLines) {
            lines.splice(maxCategoryLines - 1, lines.length - maxCategoryLines + 1);
            lines[maxCategoryLines - 1] += '...';
          }
          
          return lines;
        };
        
        // 이미지 로드 Promise 배열
        const imagePromises = Array.from(imgs).map((img, index) => {
          return new Promise((imgResolve) => {
            const tempImg = new Image();
            tempImg.onload = function() {
              // 카테고리 텍스트 가져오기
              const categoryElement = img.closest('.selected-preview')?.querySelector('.preview-category');
              const categoryText = categoryElement ? categoryElement.textContent.trim() : '';
              
              // 줄바꿈 처리하여 실제 필요한 줄 수 계산
              const lines = wrapText(categoryText, imageSize - 10);
              const categoryHeight = lines.length * categoryLineHeight + categoryPadding * 2;
              
              imgResolve({
                img: tempImg,
                originalElement: img,
                index: index,
                categoryText: categoryText,
                categoryLines: lines,
                categoryHeight: categoryHeight
              });
            };
            tempImg.onerror = function() {
              console.warn(`이미지 로드 실패: ${index + 1}번째`);
              imgResolve(null);
            };
            tempImg.src = img.src;
          });
        });

        // 모든 이미지 로드 대기
        Promise.all(imagePromises).then(loadedImages => {
          const validImages = loadedImages.filter(img => img !== null);
          
          if (validImages.length === 0) {
            resolve(null);
            return;
          }

          // 각 행의 최대 높이 계산
          const rowHeights = [];
          const rows = Math.ceil(validImages.length / cols);
          
          for (let row = 0; row < rows; row++) {
            let maxHeightInRow = 0;
            for (let col = 0; col < cols; col++) {
              const idx = row * cols + col;
              if (idx < validImages.length) {
                maxHeightInRow = Math.max(maxHeightInRow, validImages[idx].categoryHeight);
              }
            }
            rowHeights.push(maxHeightInRow);
          }
          
          // 캔버스 크기 계산
          const canvasWidth = cols * imageSize + (cols + 1) * spacing;
          const canvasHeight = titleHeight + spacing + 
            rows * (imageSize + spacing) + 
            rowHeights.reduce((sum, h) => sum + h, 0);
          
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          
          // 배경 흰색
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
          
          // 제목 그리기
          ctx.fillStyle = '#333';
          ctx.font = 'bold 24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('📸 Photo Summary', canvasWidth / 2, 30);
          
          // 각 이미지 그리기
          let currentY = titleHeight + spacing;
          
          for (let row = 0; row < rows; row++) {
            const rowHeight = imageSize + rowHeights[row];
            
            for (let col = 0; col < cols; col++) {
              const idx = row * cols + col;
              if (idx >= validImages.length) continue;
              
              const imgInfo = validImages[idx];
              const x = col * imageSize + (col + 1) * spacing;
              const y = currentY;
              
              // 셀 배경 (카테고리 영역 포함)
              ctx.fillStyle = '#f9f9f9';
              ctx.fillRect(x, y, imageSize, imageSize + imgInfo.categoryHeight);
              
              // 이미지 번호
              ctx.fillStyle = '#666';
              ctx.font = 'bold 14px Arial';
              ctx.textAlign = 'left';
              ctx.fillText(`#${imgInfo.index + 1}`, x + 5, y + 15);
              
              // 이미지 그리기
              const imgAspectRatio = imgInfo.img.width / imgInfo.img.height;
              let drawWidth = imageSize - 20; // 여백 고려
              let drawHeight = imageSize - 20;
              let offsetX = 10;
              let offsetY = 10;
              
              if (imgAspectRatio > 1) {
                drawHeight = drawWidth / imgAspectRatio;
                offsetY = 10 + (imageSize - 20 - drawHeight) / 2;
              } else {
                drawWidth = drawHeight * imgAspectRatio;
                offsetX = 10 + (imageSize - 20 - drawWidth) / 2;
              }
              
              ctx.drawImage(imgInfo.img, x + offsetX, y + offsetY, drawWidth, drawHeight);
              
              // 셀 테두리 (전체 셀)
              ctx.strokeStyle = '#ddd';
              ctx.lineWidth = 1;
              ctx.strokeRect(x, y, imageSize, imageSize + imgInfo.categoryHeight);
              
              // 이미지와 카테고리 구분선
              ctx.beginPath();
              ctx.moveTo(x, y + imageSize);
              ctx.lineTo(x + imageSize, y + imageSize);
              ctx.strokeStyle = '#e0e0e0';
              ctx.stroke();
              
              // 카테고리 텍스트
              if (imgInfo.categoryLines.length > 0) {
                ctx.fillStyle = '#555';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                
                imgInfo.categoryLines.forEach((line, lineIndex) => {
                  const textY = y + imageSize + categoryPadding + 
                    (lineIndex + 0.7) * categoryLineHeight;
                  ctx.fillText(line, x + imageSize / 2, textY);
                });
              }
            }
            
            currentY += rowHeight + spacing;
          }
          
          // Blob으로 변환
          canvas.toBlob((blob) => {
            console.log(`총합본 생성 완료: ${validImages.length}개 이미지`);
            resolve(blob);
          }, 'image/jpeg', 0.85);
        });
        
      } catch (error) {
        console.error('Summary image creation error:', error);
        resolve(null);
      }
    });
  }

  // Export 설정 강제 새로고침 (브라우저 캐시 문제 해결)
  refreshExportSettings() {
    try {
      // 이미지 변경 설정 강제 새로고침
      let activeModifications = [];
      try {
        const saved = localStorage.getItem('activeModifications');
        activeModifications = saved ? JSON.parse(saved) : ['noise', 'exif', 'adjust'];
      } catch (error) {
        activeModifications = ['noise', 'exif', 'adjust'];
        localStorage.setItem('activeModifications', JSON.stringify(activeModifications));
      }
      
      console.log('현재 저장된 activeModifications:', activeModifications);
      
      // 강제로 UI 업데이트
      const modificationOptions = document.querySelectorAll('.modification-option');
      modificationOptions.forEach(option => {
        const optionType = option.dataset.option;
        if (activeModifications.includes(optionType)) {
          option.classList.add('active');
          option.classList.remove('inactive');
          console.log(`${optionType} 옵션 활성화`);
        } else {
          option.classList.remove('active');
          option.classList.add('inactive');
          console.log(`${optionType} 옵션 비활성화`);
        }
      });
      
      console.log('Export 설정 강제 새로고침 완료');
    } catch (error) {
      console.error('Export 설정 새로고침 중 오류:', error);
    }
  }

  // Export 설정 이벤트 설정
  setupExportSettings() {
    console.log('Export 설정 초기화 중...');

    // DOM 요소가 없으면 함수 종료
    const modificationOptions = document.querySelectorAll('.modification-option');
    if (modificationOptions.length === 0) {
      console.warn('Export 설정 UI 요소를 찾을 수 없습니다. DOM이 아직 준비되지 않았을 수 있습니다.');
      return;
    }

    // 사진 값 변경 설정 이벤트
    this.setupBorderSettings();
  }

  // 사진 값 변경 설정 초기화 및 이벤트 설정
  setupBorderSettings() {
    const modificationOptions = document.querySelectorAll('.modification-option');
    const borderWidth = document.getElementById('borderWidth');
    const borderColor = document.getElementById('borderColor');
    const noiseCount = document.getElementById('noiseCount');

    if (modificationOptions.length === 0 || !borderWidth || !borderColor || !noiseCount) {
      console.warn('설정 UI 요소를 찾을 수 없습니다.');
      return;
    }

    // 저장된 설정 불러오기 (기본값: noise, exif, adjust 활성화)
    const defaultActive = ['noise', 'exif', 'adjust'];
    let activeOptions = [];
    
    try {
      const saved = localStorage.getItem('activeModifications');
      activeOptions = saved ? JSON.parse(saved) : defaultActive;
    } catch (error) {
      activeOptions = defaultActive;
    }
    
    const savedBorderWidth = localStorage.getItem('borderWidth') || '1';
    const savedBorderColor = localStorage.getItem('borderColor') || 'white';
    const savedNoiseCount = localStorage.getItem('noiseCount') || '50';

    // 초기 상태 설정
    borderWidth.value = savedBorderWidth;
    borderColor.value = savedBorderColor;
    noiseCount.value = savedNoiseCount;
    
    this.updateModificationDisplay(activeOptions);

    // 위젯 클릭 이벤트
    modificationOptions.forEach(option => {
      option.addEventListener('click', () => {
        const modificationType = option.dataset.option;
        
        if (modificationType === 'none') {
          // "변경 안함" 선택 시 모든 옵션 해제
          modificationOptions.forEach(opt => {
            opt.classList.remove('active');
            opt.classList.add('inactive');
          });
          option.classList.add('active');
          option.classList.remove('inactive');
          
          localStorage.setItem('activeModifications', JSON.stringify(['none']));
          window.Utils.showProcessingMessage('모든 이미지 변경 옵션이 비활성화되었습니다.');
        } else {
          // 다른 옵션 선택 시
          const isCurrentlyActive = option.classList.contains('active');
          const noneOption = document.querySelector('.modification-option[data-option="none"]');
          
          // "변경 안함" 해제
          if (noneOption) {
            noneOption.classList.remove('active');
            noneOption.classList.add('inactive');
          }
          
          // 현재 옵션 토글
          if (isCurrentlyActive) {
            option.classList.remove('active');
            option.classList.add('inactive');
          } else {
            option.classList.add('active');
            option.classList.remove('inactive');
          }
          
          // 활성화된 옵션들 수집
          const currentActiveOptions = [];
          modificationOptions.forEach(opt => {
            if (opt.classList.contains('active') && opt.dataset.option !== 'none') {
              currentActiveOptions.push(opt.dataset.option);
            }
          });
          
          // 활성화된 옵션이 없으면 "변경 안함" 활성화
          if (currentActiveOptions.length === 0) {
            if (noneOption) {
              noneOption.classList.add('active');
              noneOption.classList.remove('inactive');
            }
            localStorage.setItem('activeModifications', JSON.stringify(['none']));
            window.Utils.showProcessingMessage('모든 옵션이 해제되어 변경 안함으로 설정되었습니다.');
          } else {
            localStorage.setItem('activeModifications', JSON.stringify(currentActiveOptions));
            const titleElement = option.querySelector('.option-title');
            const actionText = isCurrentlyActive ? '비활성화' : '활성화';
            if (titleElement) {
              window.Utils.showProcessingMessage(`${titleElement.textContent} 옵션이 ${actionText}되었습니다.`);
            }
          }
        }
      });
    });

    // 테두리 두께 변경 이벤트
    borderWidth.addEventListener('change', () => {
      localStorage.setItem('borderWidth', borderWidth.value);
      window.Utils.showProcessingMessage(`테두리 두께가 ${borderWidth.value}px로 설정되었습니다.`);
    });

    // 테두리 색상 변경 이벤트
    borderColor.addEventListener('change', () => {
      localStorage.setItem('borderColor', borderColor.value);
      const colorNames = {
        'white': '화이트',
        'gray': '그레이', 
        'black': '블랙'
      };
      window.Utils.showProcessingMessage(`테두리 색상이 ${colorNames[borderColor.value]}로 설정되었습니다.`);
    });

    // 노이즈 개수 변경 이벤트
    noiseCount.addEventListener('change', () => {
      localStorage.setItem('noiseCount', noiseCount.value);
      window.Utils.showProcessingMessage(`노이즈 개수가 ${noiseCount.value}개로 설정되었습니다.`);
    });
  }

  // 수정 옵션 표시 업데이트
  updateModificationDisplay(activeOptions) {
    const modificationOptions = document.querySelectorAll('.modification-option');
    
    modificationOptions.forEach(option => {
      const optionType = option.dataset.option;
      if (activeOptions.includes(optionType)) {
        option.classList.add('active');
        option.classList.remove('inactive');
      } else {
        option.classList.remove('active');
        option.classList.add('inactive');
      }
    });
  }

  // 99_총합본.jpg 생성 함수
  async createSummaryImage(imgs) {
    return new Promise((resolve) => {
      try {
        // 이미지가 없는 경우 처리
        if (!imgs || imgs.length === 0) {
          resolve(null);
          return;
        }

        // Canvas 생성
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 설정: 각 이미지를 가로 700px로 리사이즈, 한 줄에 4개씩
        const targetWidth = 700;
        const imagesPerRow = 4;
        const spacing = 20; // 이미지 간 간격
        const minTextHeight = 250; // 최소 텍스트 영역 높이 (증가)
        const borderWidth = 5; // 테두리 두께
        const lineHeight = 65; // 줄 간격
        const padding = 60; // 텍스트 좌우 패딩 (더 증가)
        
        // 텍스트 줄바꿈 함수 (단순화된 버전)
        function wrapText(context, text, maxWidth) {
          const lines = [];
          let currentLine = '';
          
          // 글자 단위로 처리 (한글/영문 모두)
          const chars = text.split('');
          
          for (let i = 0; i < chars.length; i++) {
            const testLine = currentLine + chars[i];
            const testWidth = context.measureText(testLine).width;
            
            if (testWidth > maxWidth && currentLine.length > 0) {
              // 현재 줄을 저장하고 새 줄 시작
              lines.push(currentLine);
              currentLine = chars[i];
            } else {
              currentLine = testLine;
            }
          }
          
          // 마지막 줄 추가
          if (currentLine.length > 0) {
            lines.push(currentLine);
          }
          
          // 최소한 한 줄은 반환
          return lines.length > 0 ? lines : [text];
        }
        
        // 각 이미지 정보 수집
        const imagePromises = Array.from(imgs).map((img, index) => {
          return new Promise((imgResolve) => {
            const tempImg = new Image();
            tempImg.onload = function() {
              // 세로 사진인지 확인 (높이가 너비보다 큰 경우)
              const isPortrait = tempImg.height > tempImg.width;
              
              let finalWidth = tempImg.width;
              let finalHeight = tempImg.height;
              let needsRotation = false;
              
              // 세로 사진이면 회전 필요
              if (isPortrait) {
                finalWidth = tempImg.height;
                finalHeight = tempImg.width;
                needsRotation = true;
              }
              
              const scale = targetWidth / finalWidth;
              const scaledHeight = Math.round(finalHeight * scale);
              
              imgResolve({
                img: tempImg,
                originalSrc: img.src,
                width: targetWidth,
                height: scaledHeight,
                index: index,
                needsRotation: needsRotation,
                originalWidth: tempImg.width,
                originalHeight: tempImg.height,
                exportNumber: img.dataset.exportNumber || String(index + 1).padStart(2, '0'),
                category: img.dataset.category || `카테고리${index + 1}`
              });
            };
            tempImg.onerror = function() {
              console.warn(`이미지 로드 실패: ${index + 1}번째`);
              imgResolve(null);
            };
            tempImg.src = img.src;
          });
        });

        // 모든 이미지 로드 대기
        Promise.all(imagePromises).then(loadedImages => {
          const validImages = loadedImages.filter(img => img !== null);
          
          if (validImages.length === 0) {
            resolve(null);
            return;
          }

          // 먼저 텍스트 높이 계산을 위한 임시 컨텍스트
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          tempCanvas.width = 1000; // 충분한 크기로 설정
          tempCanvas.height = 500;
          
          // 각 이미지의 실제 필요한 텍스트 높이 계산
          validImages.forEach(imgInfo => {
            // 카테고리 텍스트의 줄 수 계산 - 실제 사용할 폰트로 설정
            tempCtx.font = 'bold 56px "굴림", Gulim, Arial, sans-serif';
            
            // maxWidth를 더 작게 설정 (강제로 줄바꿈 유도)
            const maxTextWidth = 500; // 고정값으로 설정
            
            // 텍스트 너비 확인
            const textWidth = tempCtx.measureText(imgInfo.category).width;
            console.log(`카테고리: "${imgInfo.category}"`);
            console.log(`  텍스트 너비: ${textWidth}px, 최대 너비: ${maxTextWidth}px`);
            
            const categoryLines = wrapText(tempCtx, imgInfo.category, maxTextWidth);
            const categoryHeight = categoryLines.length * lineHeight;
            
            console.log(`  줄 수: ${categoryLines.length}, 분리된 텍스트:`, categoryLines);
            
            // 번호 높이(1줄) + 간격 + 카테고리 높이 + 여백
            imgInfo.requiredTextHeight = Math.max(minTextHeight, 50 + 80 + categoryHeight + 30);
            imgInfo.categoryLines = categoryLines;
          });

          // 행 수 계산
          const numRows = Math.ceil(validImages.length / imagesPerRow);
          
          // 각 행의 최대 높이 계산 (동적 텍스트 높이 적용)
          const rowHeights = [];
          const rowTextHeights = [];
          for (let row = 0; row < numRows; row++) {
            let maxImageHeight = 0;
            let maxTextHeight = minTextHeight;
            for (let col = 0; col < imagesPerRow; col++) {
              const idx = row * imagesPerRow + col;
              if (idx < validImages.length) {
                maxImageHeight = Math.max(maxImageHeight, validImages[idx].height);
                maxTextHeight = Math.max(maxTextHeight, validImages[idx].requiredTextHeight);
              }
            }
            rowHeights.push(maxImageHeight + maxTextHeight);
            rowTextHeights.push(maxTextHeight);
          }

          // 캔버스 크기 설정
          const cellWidth = targetWidth + borderWidth * 2;
          const canvasWidth = cellWidth * imagesPerRow + spacing * (imagesPerRow + 1);
          const canvasHeight = rowHeights.reduce((sum, h) => sum + h + borderWidth * 2, 0) + spacing * (numRows + 1);
          
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          
          // 흰색 배경
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
          
          // 이미지와 텍스트 그리기
          let currentY = spacing;
          
          for (let row = 0; row < numRows; row++) {
            const rowHeight = rowHeights[row];
            const rowTextHeight = rowTextHeights[row];
            const cellHeight = rowHeight + borderWidth * 2;
            
            for (let col = 0; col < imagesPerRow; col++) {
              const idx = row * imagesPerRow + col;
              if (idx >= validImages.length) break;
              
              const imgInfo = validImages[idx];
              const x = spacing + col * (cellWidth + spacing);
              
              // 전체 셀 배경 (테두리 포함)
              ctx.fillStyle = 'white';
              ctx.fillRect(x, currentY, cellWidth, cellHeight);
              
              // 테두리 그리기
              ctx.strokeStyle = '#333';
              ctx.lineWidth = borderWidth;
              ctx.strokeRect(x, currentY, cellWidth, cellHeight);
              
              // 이미지 그리기 영역
              const imgX = x + borderWidth;
              const imgY = currentY + borderWidth;
              const imgAreaHeight = imgInfo.height;
              
              // 세로 이미지 회전 처리
              if (imgInfo.needsRotation) {
                // 임시 캔버스 생성하여 회전
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                
                // 원본 이미지 크기로 임시 캔버스 설정
                tempCanvas.width = imgInfo.originalHeight;
                tempCanvas.height = imgInfo.originalWidth;
                
                // 중심점을 기준으로 -90도 회전 (270도)
                tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
                tempCtx.rotate(-Math.PI / 2); // -90도 회전
                tempCtx.drawImage(imgInfo.img, -imgInfo.originalWidth / 2, -imgInfo.originalHeight / 2);
                
                // 회전된 이미지를 메인 캔버스에 그리기
                ctx.drawImage(tempCanvas, imgX, imgY, targetWidth, imgAreaHeight);
              } else {
                // 일반 가로 사진
                ctx.drawImage(imgInfo.img, imgX, imgY, targetWidth, imgAreaHeight);
              }
              
              // 텍스트 영역 배경 (테두리 안쪽, 이미지 바로 아래)
              const textY = imgY + imgAreaHeight;
              ctx.fillStyle = '#f0f0f0';
              ctx.fillRect(imgX, textY, targetWidth, rowTextHeight);
              
              // 텍스트 그리기 (AI 인식 최적화)
              ctx.fillStyle = 'black';
              // 숫자는 Arial (OCR 인식 최적)
              ctx.font = 'bold 72px Arial, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              
              // 번호 (위쪽에 충분한 여백)
              const numberText = `#${imgInfo.exportNumber}`;
              ctx.fillText(numberText, imgX + targetWidth/2, textY + 50);
              
              // 카테고리 이름 - 한글은 굴림체로 (줄바꿈 처리)
              ctx.font = 'bold 56px "굴림", Gulim, Arial, sans-serif';
              
              // 여러 줄 그리기
              if (imgInfo.categoryLines && imgInfo.categoryLines.length > 0) {
                const startY = textY + 130;
                imgInfo.categoryLines.forEach((line, lineIndex) => {
                  const lineY = startY + (lineIndex * lineHeight);
                  ctx.fillText(line, imgX + targetWidth/2, lineY);
                  console.log(`줄 ${lineIndex + 1}: "${line}" at Y=${lineY}`);
                });
              } else {
                // 폴백: 줄바꿈 실패시 한 줄로 표시
                ctx.fillText(imgInfo.category, imgX + targetWidth/2, textY + 130);
              }
            }
            
            currentY += cellHeight + spacing;
          }
          
          // Blob으로 변환
          canvas.toBlob((blob) => {
            console.log(`총합본 생성 완료: ${validImages.length}개 이미지, 크기: ${canvasWidth}x${canvasHeight}px`);
            resolve(blob);
          }, 'image/jpeg', 0.95);
        }).catch(error => {
          console.error('이미지 로드 중 오류:', error);
          resolve(null);
        });
        
      } catch (error) {
        console.error('Summary image creation error:', error);
        resolve(null);
      }
    });
  }

  // 98_파일리스트.txt 생성 함수
  createFileList(imgs) {
    try {
      let fileListContent = "===== 파일 리스트 =====\n\n";
      fileListContent += `총 ${imgs.length}개 파일\n\n`;
      fileListContent += "번호\t카테고리\t파일명\n";
      fileListContent += "=" .repeat(50) + "\n\n";
      
      Array.from(imgs).forEach((img, idx) => {
        const exportNumber = String(idx + 1).padStart(2, '0');
        const categoryName = img.dataset.category || 'Unknown';
        const safeCategoryName = categoryName.replace(/[<>:"/\\|?*]/g, '_');
        const filename = `${exportNumber}_${safeCategoryName}.jpg`;
        
        fileListContent += `${exportNumber}\t${categoryName}\t${filename}\n`;
      });
      
      fileListContent += "\n" + "=" .repeat(50) + "\n";
      fileListContent += `생성 시간: ${new Date().toLocaleString('ko-KR')}\n`;
      
      return fileListContent;
    } catch (error) {
      console.error('파일리스트 생성 오류:', error);
      return null;
    }
  }

  // Export 기능 (WebM to MP4 변환 포함)
  async exportImages() {
    if (window.isExporting) {
      alert("이미 Export가 진행 중입니다!");
      return;
    }
    
    window.isExporting = true;
    let exportBtn = null;
    
    try {
      exportBtn = document.getElementById("exportBtn");
      if (!exportBtn) {
        throw new Error("Export 버튼을 찾을 수 없습니다.");
      }
      
      window.Utils.setButtonLoading(exportBtn, true);
      window.Utils.showExportStatus("이미지 처리 중...");
      window.Utils.showProgressBar(0);
      const zip = new JSZip();
      const imgs = document.querySelectorAll("#finalPreview img");
      const totalImages = imgs.length;
      
      // 이미지 변경 설정 가져오기
      let activeModifications = [];
      try {
        const saved = localStorage.getItem('activeModifications');
        activeModifications = saved ? JSON.parse(saved) : ['noise', 'exif', 'adjust'];
      } catch (error) {
        activeModifications = ['noise', 'exif', 'adjust'];
      }
      
      const borderWidth = parseInt(localStorage.getItem('borderWidth')) || 1;
      const borderColor = localStorage.getItem('borderColor') || 'white';
      const noiseCount = parseInt(localStorage.getItem('noiseCount')) || 50;
      
      const modificationOptions = {
        activeTypes: activeModifications,
        border: {
          width: borderWidth,
          color: borderColor
        },
        noise: {
          count: noiseCount
        }
      };
      
      window.Utils.showExportStatus(`${totalImages}개 이미지 처리 중...`);

      // 배치 처리
      const batchSize = Math.min(window.uploadOptimizations.batchSize, 15); // Export는 최대 15개로 제한
      for (let i = 0; i < imgs.length; i += batchSize) {
        const batch = Array.from(imgs).slice(i, i + batchSize);
        
        for (let j = 0; j < batch.length; j++) {
          const img = batch[j];
          try {
            let blob = window.Utils.dataURLtoBlob(img.src);
            
            // 이미지 변경 처리
            if (!modificationOptions.activeTypes.includes('none') && modificationOptions.activeTypes.length > 0 && blob) {
              let currentBlob = blob;
              
              // 각 활성화된 수정 옵션을 순차적으로 적용
              for (const modificationType of modificationOptions.activeTypes) {
                if (modificationType === 'none') continue;
                
                const reader = new FileReader();
                currentBlob = await new Promise((resolve) => {
                  reader.onload = async (e) => {
                    let resultBlob;
                    
                    switch (modificationType) {
                      case 'border':
                        resultBlob = await window.Utils.addBorderToImage(e.target.result, modificationOptions.border);
                        break;
                      case 'noise':
                        resultBlob = await window.Utils.addNoiseToImage(e.target.result, modificationOptions.noise);
                        break;
                      case 'exif':
                        resultBlob = await window.Utils.removeExifData(e.target.result);
                        break;
                      case 'adjust':
                        resultBlob = await window.Utils.adjustBrightnessContrast(e.target.result);
                        break;
                      default:
                        resultBlob = window.Utils.dataURLtoBlob(e.target.result);
                    }
                    
                    resolve(resultBlob);
                  };
                  reader.readAsDataURL(currentBlob);
                });
              }
              
              blob = currentBlob;
            }
            
            // 파일명을 "번호_카테고리명.jpg" 형태로 생성
            const exportNumber = String(i + j + 1).padStart(2, '0');
            const categoryName = img.dataset.category || 'Unknown';
            // 파일명에서 특수문자 제거 (Windows 파일시스템 호환성)
            const safeCategoryName = categoryName.replace(/[<>:"/\\|?*]/g, '_');
            const filename = `${exportNumber}_${safeCategoryName}.jpg`;
            zip.file(filename, blob);
            
            await new Promise(resolve => setTimeout(resolve, 5));
          } catch (error) {
            console.warn(`이미지 ${i + j + 1} 처리 중 오류:`, error);
            continue;
          }
        }
        
        window.Utils.showProgressBar(((i + batch.length) / totalImages) * 100);
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // Export 옵션 토글 상태 확인
      const manuscriptToggle = document.getElementById('manuscriptToggle');
      const videoToggle = document.getElementById('videoToggle');
      const aiManuscriptToggle = document.getElementById('aiManuscriptToggle');
      
      const includeManuscript = manuscriptToggle ? manuscriptToggle.checked : true;
      const includeVideo = videoToggle ? videoToggle.checked : true;
      const includeAIManuscript = aiManuscriptToggle ? aiManuscriptToggle.checked : false;
      
      console.log('Export 옵션 - 총합본/파일리스트:', includeManuscript, '동영상:', includeVideo, 'AI원고:', includeAIManuscript);

      // 99_총합본.jpg 생성 (manuscriptToggle이 켜져 있을 때만)
      if (includeManuscript) {
        window.Utils.showExportStatus("총합본 이미지 생성 중...");
        
        try {
          const summaryBlob = await this.createSummaryImage(imgs);
          if (summaryBlob) {
            zip.file("99_총합본.jpg", summaryBlob);
            console.log("99_총합본.jpg 추가 완료");
          }
        } catch (error) {
          console.warn("총합본 이미지 생성 실패:", error);
        }
        
        // 98_파일리스트.txt 생성
        try {
          const fileListContent = this.createFileList(imgs);
          if (fileListContent) {
            const fileListBlob = new Blob([fileListContent], { type: 'text/plain;charset=utf-8' });
            zip.file("98_파일리스트.txt", fileListBlob);
            console.log("98_파일리스트.txt 추가 완료");
          }
        } catch (error) {
          console.warn("파일리스트 생성 실패:", error);
        }
      }
      
      // 97_원고.docx 생성 - AI 원고 생성 (result 영역에 생성된 원고가 있으면 포함)
      if (includeAIManuscript) {
        try {
          // iframe에서 원고 가져오기
          const manuscriptIframe = document.querySelector('iframe[src*="post"]');
          if (manuscriptIframe && manuscriptIframe.contentWindow) {
            const manuscript = await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('원고 요청 시간 초과'));
              }, 5000);
              
              const listener = (event) => {
                if (event.data.type === 'MANUSCRIPT_EXPORT_DOCX') {
                  clearTimeout(timeout);
                  window.removeEventListener('message', listener);
                  // ArrayBuffer를 Blob으로 변환
                  if (event.data.arrayBuffer) {
                    const blob = new Blob([event.data.arrayBuffer], { 
                      type: event.data.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
                    });
                    resolve(blob);
                  } else {
                    resolve(null);
                  }
                }
              };
              window.addEventListener('message', listener);
              
              // iframe에 export 요청
              manuscriptIframe.contentWindow.postMessage({
                type: 'REQUEST_MANUSCRIPT_DOCX_FOR_EXPORT'
              }, '*');
            });
            
            // 원고가 있으면 ZIP에 추가
            if (manuscript) {
              // 이미 Blob 형태로 받았으므로 바로 추가
              zip.file("97_원고.docx", manuscript);
              console.log("97_원고.docx 추가 완료");
              window.Utils.showProcessingMessage("AI 원고가 Export에 포함되었습니다!");
            } else {
              window.Utils.showProcessingMessage("AI 원고를 먼저 생성해주세요 (포스트 생성하기 버튼 클릭)");
            }
          } else {
            window.Utils.showProcessingMessage("원고 생성 페이지를 찾을 수 없습니다.");
          }
        } catch (error) {
          console.warn("원고 처리 실패:", error);
          window.Utils.showProcessingMessage("원고 처리 실패: " + error.message);
        }
      }
      
      // 40_최종영상.mp4 생성 (videoToggle이 켜져 있을 때만)
      if (includeVideo && (window.VideoGenerator || window.VideoGeneratorMP4) && imgs.length > 0) {
        try {
          window.Utils.showExportStatus("슬라이드쇼 비디오 생성 중...");
          
          const imageSrcs = Array.from(imgs).map(img => img.src);
          let videoBlob = null;
          let isMP4 = false;
          
          // Chrome/Edge에서 네이티브 MP4 생성 시도
          if (window.VideoGeneratorMP4 && window.VideoGeneratorMP4.canGenerateMP4()) {
            try {
              console.log('Chrome/Edge 네이티브 MP4 생성 시도...');
              const videoGenMP4 = new window.VideoGeneratorMP4();
              const result = await videoGenMP4.createSlideshow(imageSrcs, {
                slideDuration: 1000,  // 1초
                transitionDuration: 200,  // 0.2초
                fps: 30,
                onProgress: (message) => {
                  window.Utils.showExportStatus(message);
                }
              });
              
              videoBlob = result.blob;
              isMP4 = result.isMP4;
              
              if (isMP4) {
                console.log('네이티브 MP4 생성 성공!');
              }
            } catch (error) {
              console.warn('네이티브 MP4 생성 실패:', error);
            }
          }
          
          // 네이티브 MP4 생성 실패 시 WebM 생성 후 ffmpeg.wasm으로 변환
          if (!videoBlob || !isMP4) {
            const videoGen = new window.VideoGenerator();
            const webmBlob = await videoGen.createSlideshow(imageSrcs, {
              slideDuration: 1000,  // 1초
              transitionDuration: 200,  // 0.2초
              fps: 30,
              onProgress: (message) => {
                window.Utils.showExportStatus(message);
              }
            });
            
            if (webmBlob && webmBlob.size > 0) {
              // ffmpeg.wasm을 사용하여 WebM을 MP4로 변환 시도
              window.Utils.showExportStatus("비디오를 MP4로 변환 중...");
              
              try {
                // FFmpeg가 로드되어 있는지 확인
                if (typeof FFmpeg === 'undefined') {
                  throw new Error('FFmpeg.wasm이 로드되지 않았습니다.');
                }
                
                const { createFFmpeg, fetchFile } = FFmpeg;
                
                // SharedArrayBuffer 없이 단일 스레드 모드로 실행
                const ffmpeg = createFFmpeg({ 
                  log: false,
                  corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js', // Single Thread 버전 사용
                  mainName: 'main',
                  progress: ({ ratio }) => {
                    if (ratio >= 0 && ratio <= 1) {
                      const percent = Math.round(ratio * 100);
                      window.Utils.showExportStatus(`MP4 변환 중... ${percent}%`);
                    }
                  }
                });
                
                if (!ffmpeg.isLoaded()) {
                  window.Utils.showExportStatus("FFmpeg 엔진 로드 중... (첫 실행 시 시간이 걸릴 수 있습니다)");
                  await ffmpeg.load();
                  console.log('FFmpeg Single Thread 버전 로드 완료');
                }
                
                // WebM 파일을 FFmpeg 파일 시스템에 쓰기
                window.Utils.showExportStatus("비디오 파일 준비 중...");
                ffmpeg.FS('writeFile', 'input.webm', await fetchFile(webmBlob));
                
                // WebM을 MP4로 변환 (간단한 설정으로)
                window.Utils.showExportStatus("MP4로 변환 중...");
                await ffmpeg.run(
                  '-i', 'input.webm',
                  '-c:v', 'libx264',      // H.264 비디오 코덱
                  '-preset', 'ultrafast',  // 빠른 인코딩 (Single Thread에서 중요)
                  '-crf', '23',           // 품질
                  '-pix_fmt', 'yuv420p',  // 호환성을 위한 픽셀 포맷
                  'output.mp4'
                );
                
                // 변환된 MP4 파일 읽기
                const mp4Data = ffmpeg.FS('readFile', 'output.mp4');
                videoBlob = new Blob([mp4Data.buffer], { type: 'video/mp4' });
                isMP4 = true;
                
                // 메모리 정리
                try {
                  ffmpeg.FS('unlink', 'input.webm');
                  ffmpeg.FS('unlink', 'output.mp4');
                } catch (e) {
                  console.warn('파일 정리 중 오류:', e);
                }
                
                console.log('FFmpeg.wasm MP4 변환 완료');
                
              } catch (conversionError) {
                console.warn("FFmpeg.wasm MP4 변환 실패:", conversionError);
                videoBlob = webmBlob;
                isMP4 = false;
              }
            } else {
              console.warn("WebM 비디오 생성 실패");
            }
          }
          
          // 최종 비디오 파일 저장
          if (videoBlob && videoBlob.size > 0) {
            const filename = isMP4 ? "40_최종영상.mp4" : "40_최종영상.webm";
            zip.file(filename, videoBlob);
            console.log(`${filename} 추가 완료 (크기: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB)`);
            
            if (!isMP4) {
              window.Utils.showProcessingMessage("MP4 변환이 실패하여 WebM 형식으로 저장되었습니다.");
            }
          }
          
        } catch (error) {
          console.warn("비디오 생성 실패:", error);
          // 비디오 생성 실패해도 export는 계속 진행
          window.Utils.showExportStatus("비디오 생성 실패, 이미지만 export합니다...");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      window.Utils.showExportStatus("ZIP 파일 생성 중...");
      
      const content = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 3 },
        streamFiles: true
      });
      
      window.Utils.showExportStatus("다운로드 준비 중...");
      
      // 적용된 수정 옵션들 메시지 생성
      let resultMessages = [];
      if (!modificationOptions.activeTypes.includes('none') && modificationOptions.activeTypes.length > 0) {
        const appliedModifications = [];
        
        modificationOptions.activeTypes.forEach(type => {
          switch (type) {
            case 'border':
              const colorNames = { 'white': '화이트', 'gray': '그레이', 'black': '블랙' };
              const colorName = colorNames[modificationOptions.border.color] || modificationOptions.border.color;
              appliedModifications.push(`${modificationOptions.border.width}px ${colorName} 테두리`);
              break;
            case 'noise':
              appliedModifications.push(`${modificationOptions.noise.count}개의 미세 노이즈`);
              break;
            case 'exif':
              appliedModifications.push('EXIF 정보 제거');
              break;
            case 'adjust':
              appliedModifications.push('밝기/대비 조절');
              break;
          }
        });
        
        if (appliedModifications.length > 0) {
          resultMessages.push(`모든 이미지에 ${appliedModifications.join(', ')}이(가) 적용되었습니다.`);
        }
      }
      
      if (resultMessages.length > 0) {
        window.Utils.showProcessingMessage(resultMessages.join(' '));
      }
      
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `photos_${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
      }, 1000);
      
      window.Utils.showExportStatus("다운로드 완료!");
      window.Utils.hideExportStatus();
      window.Utils.hideProgressBar();
      
    } catch (error) {
      console.error("Export error:", error);
      
      let errorMessage = "오류가 발생했습니다.";
      if (error.message.includes("memory") || error.message.includes("Memory")) {
        errorMessage = "메모리 부족으로 인한 오류입니다. 이미지 수를 줄이거나 크기를 줄여서 다시 시도해주세요.";
      } else if (error.message.includes("size") || error.message.includes("Size")) {
        errorMessage = "파일 크기가 너무 큽니다. 이미지 수를 줄이거나 크기를 줄여서 다시 시도해주세요.";
      } else if (error.message.includes("찾을 수 없습니다")) {
        errorMessage = "UI 요소를 찾을 수 없습니다. 페이지를 새로고침해주세요.";
      } else {
        errorMessage = `오류 상세: ${error.message}`;
      }
      
      window.Utils.showExportStatus(errorMessage);
      window.Utils.hideExportStatus();
      window.Utils.hideProgressBar();
    } finally {
      window.isExporting = false;
      if (exportBtn) {
        window.Utils.setButtonLoading(exportBtn, false);
      }
    }
  }

  // 저장된 상태 목록 토글
  toggleStatesList() {
    const list = document.getElementById("savedStatesList");
    const button = document.getElementById("toggleStatesList");
    
    console.log('toggleStatesList 호출됨');
    console.log('list element:', list);
    console.log('button element:', button);
    
    if (list.style.display === "none") {
      list.style.display = "block";
      button.textContent = "📋 저장된 상태 목록 숨기기";
      console.log('리스트를 표시하고 loadSavedStatesList 호출');
      this.stateManager.loadSavedStatesList();
    } else {
      list.style.display = "none";
      button.textContent = "📋 저장된 상태 목록";
    }
  }

  // 전역 함수로 등록
  addNewCategory() {
    this.categoryManager.addNewCategory();
  }

  deleteCategory(categoryName) {
    this.categoryManager.deleteCategory(categoryName);
  }

  updateCategoryName(oldName, newName) {
    this.categoryManager.updateCategoryName(oldName, newName);
  }

  toggleCategory(categoryName) {
    this.categoryManager.toggleCategory(categoryName);
  }

  toggleCategoryEnabled(categoryName) {
    this.categoryManager.toggleCategoryEnabled(categoryName);
  }

  // 자동저장 시작
  startAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    // 자동저장이 비활성화된 경우 시작하지 않음
    if (this.autoSaveTime === 0) {
      console.log('자동저장이 비활성화되어 있어 시작하지 않음');
      return;
    }
    
    this.autoSaveInterval = setInterval(() => {
      this.performAutoSave();
    }, this.autoSaveTime);
    
    this.updateLastAutoSaveDisplay();
    console.log(`자동저장이 ${this.autoSaveTime/1000}초 간격으로 시작됨`);
  }

  // 자동저장 정지
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
      console.log('자동저장이 정지됨');
    }
  }

  // 자동저장 재시작
  restartAutoSave() {
    this.startAutoSave();
  }

  // 현재 데이터의 해시값 계산 (변경사항 감지용)
  async calculateDataHash() {
    try {
      const dataForHash = {
        categories: this.categoryManager.categories,
        categoryFileCounts: {},
        selectedImages: Array.from(window.selectedImages),
        thumbnailSize: window.thumbnailSize,
        categoryCounter: this.categoryManager.categoryCounter
      };
      
      // 각 카테고리의 파일 개수만 포함 (파일 내용은 제외하여 해시 계산 속도 향상)
      this.categoryManager.categories.forEach(cat => {
        if (this.categoryManager.categoryData[cat.name]) {
          dataForHash.categoryFileCounts[cat.name] = this.categoryManager.categoryData[cat.name].files.length;
        }
      });
      
      const dataString = JSON.stringify(dataForHash);
      
      // 간단한 해시 함수 (crypto.subtle 대신 사용)
      let hash = 0;
      if (dataString.length === 0) return hash.toString();
      
      for (let i = 0; i < dataString.length; i++) {
        const char = dataString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 32비트 정수로 변환
      }
      
      return Math.abs(hash).toString();
    } catch (error) {
      console.error('해시 계산 중 오류:', error);
      return Date.now().toString(); // 오류 시 현재 시간을 해시로 사용 (항상 저장되도록)
    }
  }

  // 자동저장 수행 (이미지 포함)
  async performAutoSave() {
    // 이미 자동저장이 진행 중이면 무시
    if (this.isAutoSaving) {
      console.log('자동저장이 이미 진행 중이므로 건너뜀');
      return;
    }

    // 자동저장이 비활성화된 경우 실행하지 않음
    if (this.autoSaveTime === 0) {
      console.log('자동저장이 비활성화되어 있어 실행하지 않음');
      return;
    }

    try {
      this.isAutoSaving = true; // 자동저장 시작 플래그 설정
      
      console.log('=== 자동저장 시작 (이미지 포함) ===');
      console.log('현재 문서명:', this.currentDocumentName);
      
      // 현재 데이터의 해시값 계산하여 변경사항 확인
      const currentDataHash = await this.calculateDataHash();
      
      // 이전 저장과 동일한 데이터인 경우 저장하지 않음
      if (this.lastSaveHash && this.lastSaveHash === currentDataHash) {
        console.log('데이터가 변경되지 않아 자동저장을 건너뜀');
        this.lastAutoSave = Date.now();
        this.updateLastAutoSaveDisplay('변경사항 없음 - 저장 건너뜀');
        return;
      }
      
      // 현재 문서가 있으면 해당 문서에 저장, 없으면 자동저장용 이름 생성
      const saveTarget = this.currentDocumentName || `AutoSave_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;
      
      console.log('저장 대상:', saveTarget);
      
      // stateManager의 저장 로직을 활용하되 자동저장 모드로 실행
      await this.stateManager.saveCurrentStateInternal(saveTarget, true);
      
      // 저장 성공 시 해시값 업데이트
      this.lastSaveHash = currentDataHash;
      this.lastAutoSave = Date.now();
      this.updateLastAutoSaveDisplay();
      console.log('=== 자동저장 완료 ===');
    } catch (error) {
      console.error('자동저장 중 오류:', error);
      console.error('오류 스택:', error.stack);
      this.updateLastAutoSaveDisplay('자동저장 오류');
    } finally {
      this.isAutoSaving = false; // 자동저장 완료 플래그 해제
    }
  }

  // 자동저장 상태 확인 (디버깅용)
  async checkAutoSaveStatus() {
    console.log('=== 자동저장 상태 확인 ===');
    
    let statusMessage = '📊 자동저장 상태 확인\n\n';
    
    // 자동저장 간격 및 활성 상태
    if (this.autoSaveTime === 0) {
      statusMessage += `⏰ 자동저장 간격: 비활성화\n`;
      statusMessage += `🔄 자동저장 활성: ❌ 비활성\n`;
    } else {
      statusMessage += `⏰ 자동저장 간격: ${this.autoSaveTime}ms (${this.autoSaveTime/1000}초)\n`;
      statusMessage += `🔄 자동저장 활성: ${!!this.autoSaveInterval ? '✅ 활성' : '❌ 비활성'}\n`;
    }
    
    statusMessage += `📅 마지막 자동저장: ${this.lastAutoSave ? new Date(this.lastAutoSave).toLocaleString() : '없음'}\n`;
    statusMessage += `📄 현재 문서명: ${this.currentDocumentName || '새 문서'}\n`;
    statusMessage += `🔒 자동저장 진행중: ${this.isAutoSaving ? '예' : '아니오'}\n`;
    statusMessage += `#️⃣ 마지막 저장 해시: ${this.lastSaveHash ? this.lastSaveHash.substring(0, 8) + '...' : '없음'}\n\n`;
    
    // localStorage 확인
    const localStorageData = localStorage.getItem('photoClassifierAutoSave');
    if (localStorageData) {
      try {
        const parsed = JSON.parse(localStorageData);
        statusMessage += `💾 localStorage 데이터:\n`;
        statusMessage += `  - 저장시간: ${new Date(parsed.timestamp).toLocaleString()}\n`;
        statusMessage += `  - 카테고리수: ${Object.keys(parsed.categoryData || {}).length}개\n`;
        statusMessage += `  - 선택이미지수: ${parsed.selectedImages ? parsed.selectedImages.length : 0}개\n`;
        statusMessage += `  - 데이터크기: ${(localStorageData.length / 1024).toFixed(1)}KB\n\n`;
      } catch (e) {
        statusMessage += `❌ localStorage 데이터 파싱 오류\n\n`;
      }
    } else {
      statusMessage += `💾 localStorage: 데이터 없음\n\n`;
    }
    
    // IndexedDB 확인
    if (this.currentDocumentName) {
      try {
        const db = await this.stateManager.initIndexedDB();
        const transaction = db.transaction(['states'], 'readonly');
        const store = transaction.objectStore('states');
        
        const savedState = await new Promise((resolve, reject) => {
          const request = store.get(this.currentDocumentName);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        if (savedState) {
          // 파일 개수와 크기 계산
          let totalFiles = 0;
          let totalSize = 0;
          
          if (savedState.categoryFiles) {
            Object.entries(savedState.categoryFiles).forEach(([categoryName, files]) => {
              if (Array.isArray(files)) {
                totalFiles += files.length;
                files.forEach(base64Data => {
                  try {
                    let dataString = '';
                    if (typeof base64Data === 'object' && base64Data.data) {
                      dataString = base64Data.data;
                    } else if (typeof base64Data === 'string') {
                      dataString = base64Data;
                    }
                    
                    if (dataString && dataString.length > 0) {
                      const fileSize = Math.ceil(dataString.length * 0.75);
                      totalSize += fileSize;
                    }
                  } catch (error) {
                    console.warn('파일 크기 계산 중 오류:', error);
                  }
                });
              }
            });
          }
          
          statusMessage += `🗃️ IndexedDB 데이터:\n`;
          statusMessage += `  - 이름: ${savedState.name}\n`;
          statusMessage += `  - 저장시간: ${savedState.timestamp}\n`;
          statusMessage += `  - 카테고리수: ${Object.keys(savedState.categoryFiles || {}).length}개\n`;
          statusMessage += `  - 총 파일수: ${totalFiles}개\n`;
          statusMessage += `  - 총 크기: ${(totalSize / 1024 / 1024).toFixed(1)}MB\n`;
          statusMessage += `  - 선택이미지수: ${savedState.selectedImages ? savedState.selectedImages.length : 0}개\n\n`;
          
          // 카테고리별 파일 개수
          if (savedState.categoryFiles && Object.keys(savedState.categoryFiles).length > 0) {
            statusMessage += `📂 저장된 카테고리별 파일:\n`;
            Object.entries(savedState.categoryFiles).forEach(([categoryName, files]) => {
              const fileCount = Array.isArray(files) ? files.length : 0;
              statusMessage += `  - ${categoryName}: ${fileCount}개\n`;
            });
            statusMessage += `\n`;
          }
        } else {
          statusMessage += `🗃️ IndexedDB: 해당 문서 데이터 없음\n\n`;
        }
      } catch (error) {
        statusMessage += `❌ IndexedDB 확인 중 오류: ${error.message}\n\n`;
      }
    } else {
      statusMessage += `🗃️ IndexedDB: 현재 문서 없음\n\n`;
    }
    
    // 현재 메모리 상태 확인
    statusMessage += `🧠 현재 메모리 상태:\n`;
    statusMessage += `  - 카테고리수: ${this.categoryManager.categories.length}개\n`;
    statusMessage += `  - 카테고리데이터: ${Object.keys(this.categoryManager.categoryData).length}개\n`;
    statusMessage += `  - 선택이미지수: ${window.selectedImages.size}개\n`;
    statusMessage += `  - 썸네일크기: ${window.thumbnailSize}px\n`;
    
    // 현재 메모리의 파일 개수와 크기 계산
    let currentTotalFiles = 0;
    let currentTotalSize = 0;
    
    Object.values(this.categoryManager.categoryData).forEach(categoryData => {
      if (categoryData && categoryData.files && Array.isArray(categoryData.files)) {
        currentTotalFiles += categoryData.files.length;
        categoryData.files.forEach(file => {
          try {
            if (file && file.size) {
              currentTotalSize += file.size;
            }
          } catch (error) {
            console.warn('현재 파일 크기 계산 중 오류:', error);
          }
        });
      }
    });
    
    statusMessage += `  - 현재 총 파일수: ${currentTotalFiles}개\n`;
    statusMessage += `  - 현재 총 크기: ${(currentTotalSize / 1024 / 1024).toFixed(1)}MB\n\n`;
    
    // 각 카테고리별 상세 정보
    if (Object.keys(this.categoryManager.categoryData).length > 0) {
      statusMessage += `📂 현재 메모리 카테고리별 상세:\n`;
      Object.keys(this.categoryManager.categoryData).forEach(categoryName => {
        const category = this.categoryManager.categoryData[categoryName];
        const fileCount = category.files ? category.files.length : 0;
        const previewCount = category.previews ? category.previews.length : 0;
        
        // 카테고리별 파일 크기 계산
        let categorySize = 0;
        if (category.files && Array.isArray(category.files)) {
          category.files.forEach(file => {
            try {
              if (file && file.size) {
                categorySize += file.size;
              }
            } catch (error) {
              console.warn('카테고리 파일 크기 계산 중 오류:', error);
            }
          });
        }
        
        statusMessage += `  - ${categoryName}: 파일 ${fileCount}개 (${(categorySize / 1024 / 1024).toFixed(1)}MB), 미리보기 ${previewCount}개\n`;
      });
    }
    
    // 페이지 내 모달 팝업으로 표시
    this.showStatusModal(statusMessage);
  }

  // 상태 정보 모달 팝업 표시
  showStatusModal(statusMessage) {
    // 기존 모달이 있으면 제거
    const existingModal = document.getElementById('statusModal');
    if (existingModal) {
      existingModal.remove();
    }

    // 모달 HTML 생성
    const modalHTML = `
      <div id="statusModal" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: system-ui, -apple-system, sans-serif;
      ">
        <div style="
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          max-width: 90vw;
          max-height: 90vh;
          width: 800px;
          display: flex;
          flex-direction: column;
        ">
          <!-- 헤더 -->
          <div style="
            padding: 20px 25px 15px 25px;
            border-bottom: 2px solid #007bff;
            background: #f8f9fa;
            border-radius: 12px 12px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <h2 style="margin: 0; color: #007bff; font-size: 18px;">📊 자동저장 상태 확인</h2>
            <button onclick="this.closest('#statusModal').remove()" style="
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 6px;
              padding: 8px 12px;
              cursor: pointer;
              font-size: 14px;
            ">❌ 닫기</button>
          </div>
          
          <!-- 내용 -->
          <div style="
            padding: 20px 25px;
            overflow-y: auto;
            flex: 1;
            max-height: calc(90vh - 140px);
          ">
            <pre style="
              font-family: 'Courier New', monospace;
              font-size: 13px;
              line-height: 1.5;
              white-space: pre-wrap;
              word-wrap: break-word;
              margin: 0;
              color: #333;
              background: #f8f9fa;
              padding: 15px;
              border-radius: 6px;
              border: 1px solid #dee2e6;
            ">${statusMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          </div>
          
          <!-- 하단 버튼 -->
          <div style="
            padding: 15px 25px;
            border-top: 1px solid #dee2e6;
            background: #f8f9fa;
            border-radius: 0 0 12px 12px;
            text-align: center;
          ">
            <button onclick="navigator.clipboard.writeText(\`${statusMessage.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`).then(() => alert('클립보드에 복사되었습니다!'))" style="
              background: #28a745;
              color: white;
              border: none;
              border-radius: 6px;
              padding: 10px 20px;
              margin: 0 10px;
              cursor: pointer;
              font-size: 14px;
            ">📋 복사</button>
            <button onclick="window.print()" style="
              background: #17a2b8;
              color: white;
              border: none;
              border-radius: 6px;
              padding: 10px 20px;
              margin: 0 10px;
              cursor: pointer;
              font-size: 14px;
            ">🖨️ 인쇄</button>
          </div>
        </div>
      </div>
    `;

    // 모달을 페이지에 추가
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // ESC 키로 모달 닫기
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('statusModal');
        if (modal) {
          modal.remove();
          document.removeEventListener('keydown', handleEsc);
        }
      }
    };
    document.addEventListener('keydown', handleEsc);

    // 모달 배경 클릭으로 닫기
    const modal = document.getElementById('statusModal');
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        document.removeEventListener('keydown', handleEsc);
      }
    });
  }
  updateLastAutoSaveDisplay(statusMessage = null) {
    const lastAutoSaveElement = document.getElementById('lastAutoSave');
    if (lastAutoSaveElement) {
      if (statusMessage) {
        lastAutoSaveElement.textContent = statusMessage;
        lastAutoSaveElement.style.color = '#ffc107'; // 노란색으로 특별 상태 표시
      } else if (this.lastAutoSave > 0) {
        const date = new Date(this.lastAutoSave);
        lastAutoSaveElement.textContent = date.toLocaleString();
        lastAutoSaveElement.style.color = '#28a745'; // 녹색으로 정상 상태 표시
      } else {
        lastAutoSaveElement.textContent = '-';
        lastAutoSaveElement.style.color = '#6c757d'; // 회색
      }
    }
    
    // 현재 문서 상태 업데이트
    this.updateCurrentDocumentDisplay();
  }

  // 현재 문서 상태 표시 업데이트
  updateCurrentDocumentDisplay() {
    const currentDocumentElement = document.getElementById('currentDocument');
    if (currentDocumentElement) {
      if (this.currentDocumentName) {
        currentDocumentElement.textContent = this.currentDocumentName;
        currentDocumentElement.style.color = '#28a745'; // 녹색
      } else {
        currentDocumentElement.textContent = '새 문서 (마지막 작업내역)';
        currentDocumentElement.style.color = '#007bff'; // 파란색
      }
    }
  }

  // 마지막 세션 데이터 로드
  loadLastSession() {
    console.log('loadLastSession 호출됨');
    console.log('currentDocumentName:', this.currentDocumentName);
    
    // 처음 실행 시 항상 빈 프로젝트로 시작
    // 현재 문서명이 있어도 자동으로 불러오지 않음
    /*
    if (this.currentDocumentName) {
      console.log('현재 문서 불러오기 시도:', this.currentDocumentName);
      // 프로젝트 불러오기
      this.stateManager.loadSavedState(this.currentDocumentName).catch(error => {
        console.error('프로젝트 불러오기 실패:', error);
        // 불러오기 실패시 새 프로젝트로 시작
        this.showNewProjectMessage();
      });
    } else {
      // 현재 문서가 없으면 새 프로젝트로 시작
      this.showNewProjectMessage();
    }
    */
    
    // 항상 새 프로젝트로 시작
    this.showNewProjectMessage();
    
    // 현재 문서명 초기화
    this.currentDocumentName = null;
    localStorage.removeItem('currentDocumentName');
    this.updateCurrentDocumentDisplay();
    
    // 저장된 상태 목록 업데이트 (언제나 실행)
    console.log('savedStatesList 초기 로드');
    this.stateManager.loadSavedStatesList().catch(error => {
      console.error('savedStatesList 로드 실패:', error);
    });
  }

  // 새 프로젝트 메시지 표시
  showNewProjectMessage() {
    // 카테고리 초기화
    this.categoryManager.categoryData = {};
    this.categoryManager.categories = [];
    window.selectedImages = new Set();
    
    // 카테고리 컨테이너에 메시지 표시
    const categoriesContainer = document.getElementById('categories');
    if (categoriesContainer) {
      categoriesContainer.innerHTML = `
        <div style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
          <h3 style="margin-bottom: 20px;">📁 새 프로젝트</h3>
          <p style="margin-bottom: 30px; font-size: 16px;">신규 프로젝트 생성 후 카테고리를 추가해주세요</p>
          <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
            <button onclick="window.app.toggleStatesList()" style="background: var(--button-bg); padding: 10px 20px; border-radius: 8px; border: none; color: white; cursor: pointer;">
              📂 저장된 프로젝트 불러오기
            </button>
            <button onclick="window.app.stateManager.createNewProject()" style="background: #28a745; padding: 10px 20px; border-radius: 8px; border: none; color: white; cursor: pointer;">
              🆕 신규 프로젝트 생성
            </button>
          </div>
        </div>
      `;
    }
    
    // 미리보기 카운트 팝업 업데이트
    this.categoryManager.updatePreviewCountPopup();
  }

  // 세션에서 미리보기 복원
  async restorePreviewsFromSession() {
    try {
      const autoSaveData = localStorage.getItem('photoClassifierAutoSave');
      if (!autoSaveData) return;
      
      const data = JSON.parse(autoSaveData);
      if (!data.categoryData) return;
      
      let restoredCount = 0;
      
      // 각 카테고리의 미리보기 복원
      for (const [categoryName, categoryInfo] of Object.entries(data.categoryData)) {
        if (categoryInfo.previews && categoryInfo.previews.length > 0) {
          const wrapper = document.querySelector(`[data-category="${categoryName}"]`);
          if (wrapper) {
            const container = wrapper.querySelector('.preview-container');
            if (container) {
              // 기존 미리보기 제거
              container.innerHTML = '';
              
              // 미리보기 다시 생성
              for (let i = 0; i < categoryInfo.previews.length; i++) {
                const fileData = categoryInfo.previews[i];
                if (fileData && fileData.name) {
                  // File 객체로 변환
                  const file = new File([fileData], fileData.name, {
                    type: fileData.type || 'image/jpeg',
                    lastModified: fileData.lastModified || Date.now()
                  });
                  
                  const div = document.createElement('div');
                  div.className = 'preview-item';
                  div.style.position = 'relative';
                  
                  const img = document.createElement('img');
                  img.className = 'preview-img';
                  img.style.width = window.thumbnailSize + 'px';
                  img.style.height = window.thumbnailSize + 'px';
                  img.style.objectFit = 'cover';
                  img.style.cursor = 'pointer';
                  img.dataset.category = categoryName;
                  
                  // 이미지 로드
                  if (fileData.src) {
                    img.src = fileData.src;
                  } else {
                    const reader = new FileReader();
                    reader.onload = e => {
                      img.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                  }
                  
                  // 제거 버튼
                  const removeBtn = document.createElement('button');
                  removeBtn.className = 'remove-btn';
                  removeBtn.textContent = '×';
                  removeBtn.onclick = () => this.categoryManager.removeImage(categoryName, file, div);
                  
                  div.appendChild(img);
                  div.appendChild(removeBtn);
                  container.appendChild(div);
                  
                  // categoryData에 파일 추가
                  if (!this.categoryManager.categoryData[categoryName]) {
                    this.categoryManager.categoryData[categoryName] = { files: [], previews: [] };
                  }
                  this.categoryManager.categoryData[categoryName].previews.push(file);
                  
                  restoredCount++;
                }
              }
              
              // 미리보기 수 업데이트
              const previewInput = wrapper.querySelector('input[type="number"]');
              if (previewInput) {
                previewInput.value = categoryInfo.previews.length;
              }
            }
          }
        }
      }
      
      if (restoredCount > 0) {
        this.categoryManager.updateSelectedCount();
        this.categoryManager.updatePreviewCountPopup();
        window.Utils.showProcessingMessage(`${restoredCount}개의 미리보기가 복원되었습니다!`);
      }
    } catch (error) {
      console.error('미리보기 복원 중 오류:', error);
    }
  }

  // 페이지 언로드 시 자동저장
  setupBeforeUnload() {
    const beforeUnloadHandler = async (e) => {
      // 자동저장이 이미 진행 중이 아닐 때만 실행
      if (!this.isAutoSaving && this.currentDocumentName) {
        try {
          // 동기적으로 빠른 저장 시도
          await this.performAutoSave();
        } catch (error) {
          console.warn('페이지 종료 시 자동저장 오류:', error);
        }
      }
      this.cleanup();
    };
    
    window.addEventListener('beforeunload', beforeUnloadHandler);
    this.eventListeners.push({
      element: window,
      event: 'beforeunload',
      handler: beforeUnloadHandler
    });
  }


}

// DOM이 완전히 로드된 후 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
  try {
    // 앱 초기화
    const app = new PhotoClassifierApp();

    // 전역 객체로 등록
    window.app = app;
  } catch (error) {
    console.error('앱 초기화 중 오류가 발생했습니다:', error);
    alert('앱 초기화 중 오류가 발생했습니다. 브라우저 콘솔을 확인해주세요.');
  }
});