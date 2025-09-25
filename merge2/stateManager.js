// StateManager 클래스 - 서버 기반 저장 시스템
window.StateManager = class StateManager {
  constructor(categoryManager) {
    this.categoryManager = categoryManager;
    this.apiBaseUrl = './api'; // API 기본 URL
    this.forceEmptyState = false; // 강제 빈 상태 플래그 초기화
  }

  /**
   * 프로젝트명으로부터 폴더명 생성 (PHP와 동일한 로직)
   */
  getProjectFolderName(projectName) {
    if (!projectName) {
      return 'project_0000000000000000';
    }
    
    let hash = 0;
    for (let i = 0; i < projectName.length; i++) {
      const char = projectName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash | 0; // 32비트 정수로 변환
    }
    
    // 음수를 양수로 변환
    const absHash = Math.abs(hash);
    
    // 16진수로 변환하고 16자리로 맞춤
    let hex = absHash.toString(16);
    if (hex.length > 16) {
      hex = hex.substring(0, 16);
    } else {
      hex = hex.padEnd(16, '0');
    }
    
    return 'project_' + hex;
  }

  // API 호출 헬퍼 함수
  async apiCall(endpoint, options = {}) {
    const fullUrl = `${this.apiBaseUrl}/${endpoint}`;
    console.log('apiCall 호출 - URL:', fullUrl, 'Options:', options);
    
    try {
      const response = await fetch(fullUrl, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      console.log('Response status:', response.status);
      
      // 응답 텍스트 먼저 확인
      const responseText = await response.text();
      console.log('Response text (first 200 chars):', responseText.substring(0, 200));
      
      // JSON 파싱 시도
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON 파싱 오류:', responseText);
        throw new Error('서버 응답을 파싱할 수 없습니다: ' + responseText.substring(0, 100));
      }
      
      if (!data.success) {
        throw new Error(data.message || 'API 호출 실패');
      }
      
      return data;
    } catch (error) {
      console.error('API 호출 오류:', error);
      throw error;
    }
  }

  // 이미지 업로드 함수
  async uploadImages(projectName, categoryName, files) {
    const formData = new FormData();
    formData.append('project', projectName);
    formData.append('category', categoryName);
    
    // 파일들을 FormData에 추가
    if (Array.isArray(files)) {
      files.forEach(file => {
        formData.append('images[]', file);
      });
    } else {
      formData.append('images[]', files);
    }
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/images.php`, {
        method: 'POST',
        body: formData
      });
      
      // 응답 텍스트 먼저 확인
      const responseText = await response.text();
      
      // JSON 파싱 시도
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('이미지 업로드 응답 파싱 오류:', responseText);
        throw new Error('서버 응답을 파싱할 수 없습니다');
      }
      
      if (!data.success) {
        throw new Error(data.message || '이미지 업로드 실패');
      }
      
      return data.data;
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      throw error;
    }
  }

  // 현재 상태 저장 (서버 기반)
  async saveCurrentState() {
    const saveBtn = document.getElementById("saveState");
    const stateName = document.getElementById("stateName").value.trim();
    
    if (!stateName) {
      alert("저장할 이름을 입력해주세요!");
      return;
    }
    
    await this.saveCurrentStateInternal(stateName, false, saveBtn);
  }

  // 내부 저장 함수 (자동저장과 수동저장 공용)
  async saveCurrentStateInternal(stateName, isAutoSave = false, saveBtn = null) {
    // 이미 저장이 진행 중인 경우 대기 또는 건너뛰기
    if (window.app && window.app.isAutoSaving && !isAutoSave) {
      console.log('자동저장이 진행 중이므로 수동저장을 잠시 대기');
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!window.app.isAutoSaving) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      });
    } else if (window.app && window.app.isAutoSaving && isAutoSave) {
      console.log('이미 자동저장이 진행 중이므로 이번 자동저장 건너뛰기');
      return;
    }
    
    if (saveBtn) {
      window.Utils.setButtonLoading(saveBtn, true);
    }
    
    const message = isAutoSave ? '자동저장 중...' : '상태를 저장하는 중...';
    window.Utils.showProcessingMessage(message);
    
    try {
      if (!isAutoSave) {
        window.Utils.showProgressBar(0);
      }
      
      // 미리보기 수 수집
      const categoryPreviewCounts = {};
      this.categoryManager.categories.forEach(cat => {
        const wrapper = document.querySelector(`[data-category="${cat.name}"]`);
        if (wrapper) {
          const previewInput = wrapper.querySelector("input[type=number]");
          if (previewInput) {
            categoryPreviewCounts[cat.name] = parseInt(previewInput.value);
          }
        }
      });
      
      // iframe의 post 데이터 수집 (postMessage 방식)
      let postData = {};
      const postIframe = document.querySelector('iframe[src*="post"]');
      if (postIframe && postIframe.contentWindow) {
        try {
          // 먼저 직접 접근 시도
          const postDoc = postIframe.contentDocument || postIframe.contentWindow.document;
          const storeNameEl = postDoc.getElementById('store-name');
          const storeInfoEl = postDoc.getElementById('store-info');
          
          if (storeNameEl || storeInfoEl) {
            postData = {
              storeName: storeNameEl ? storeNameEl.value : '',
              storeInfo: storeInfoEl ? storeInfoEl.value : ''
            };
            console.log('iframe 데이터 수집 성공:', postData);
          }
        } catch (e) {
          console.log('iframe 직접 접근 실패, postMessage 방식 필요:', e);
          // 같은 도메인이 아닌 경우 postMessage를 사용해야 함
          // 하지만 여기서는 수집할 수 없으므로 빈 객체로 진행
          postData = {};
        }
      } else {
        console.log('post iframe을 찾을 수 없습니다');
      }
      
      // 프로젝트 메타데이터 저장
      const projectData = {
        name: stateName,
        categories: this.categoryManager.categories,
        category_preview_counts: categoryPreviewCounts,
        selected_images: Array.from(window.selectedImages),
        thumbnail_size: window.thumbnailSize,
        category_counter: this.categoryManager.categoryCounter,
        post_data: postData  // post 데이터 추가
      };
      
      // 프로젝트 정보를 서버에 저장
      await this.apiCall('projects.php', {
        method: 'POST',
        body: JSON.stringify(projectData)
      });
      
      let totalFiles = 0;
      let processedFiles = 0;
      
      // 총 파일 수 계산
      this.categoryManager.categories.forEach(cat => {
        if (this.categoryManager.categoryData[cat.name] && this.categoryManager.categoryData[cat.name].files) {
          totalFiles += this.categoryManager.categoryData[cat.name].files.length;
        }
      });
      
      console.log(`${isAutoSave ? '자동저장' : '수동저장'} 시작 - 총 ${totalFiles}개 파일 처리`);
      
      // 각 카테고리의 이미지 업로드
      for (const cat of this.categoryManager.categories) {
        if (this.categoryManager.categoryData[cat.name] && this.categoryManager.categoryData[cat.name].files.length > 0) {
          try {
            // 기존 이미지 삭제 (카테고리별로)
            await this.deleteProjectImages(stateName, cat.name);
            
            // 새 이미지 업로드
            const files = this.categoryManager.categoryData[cat.name].files;
            if (files.length > 0) {
              await this.uploadImages(stateName, cat.name, files);
            }
            
            processedFiles += files.length;
            
            if (!isAutoSave) {
              window.Utils.showProgressBar((processedFiles / totalFiles) * 100);
            }
            
            if (processedFiles % (isAutoSave ? 20 : 10) === 0) {
              await new Promise(resolve => setTimeout(resolve, isAutoSave ? 1 : 5));
            }
          } catch (fileError) {
            console.error(`카테고리 ${cat.name} 파일 처리 중 오류:`, fileError);
            continue;
          }
        }
      }
      
      console.log(`파일 처리 완료 - 총 ${processedFiles}개 파일`);
      
      // 저장된 상태 목록 갱신
      await this.loadSavedStatesList();
      
      if (!isAutoSave) {
        window.Utils.hideProgressBar();
      }
      
      if (saveBtn) {
        window.Utils.setButtonLoading(saveBtn, false);
      }
      
      const successMessage = isAutoSave ? 
        `자동저장 완료 (${processedFiles}개 파일)` : 
        `저장이 완료되었습니다! (${processedFiles}개 파일)`;
      
      window.Utils.showProcessingMessage(successMessage);
      
      // 현재 문서명 업데이트 (수동저장시에만)
      if (!isAutoSave && window.app) {
        window.app.currentDocumentName = stateName;
        localStorage.setItem('currentDocumentName', stateName);
        window.app.updateCurrentDocumentDisplay();
        
        // 수동 저장 후 해시 업데이트
        try {
          if (window.app.calculateDataHash && typeof window.app.calculateDataHash === 'function') {
            window.app.lastSaveHash = await window.app.calculateDataHash();
          }
        } catch (hashError) {
          console.warn('해시 계산 중 오류:', hashError);
        }
      }
      
      // 자동저장이 아닌 수동저장일 때만 자동저장 트리거
      if (!isAutoSave) {
        this.triggerAutoSave();
      }
      
    } catch (error) {
      console.error(`${isAutoSave ? '자동저장' : '저장'} 중 오류:`, error);
      
      if (!isAutoSave) {
        alert(`저장 중 오류가 발생했습니다: ${error.message}`);
        window.Utils.hideProgressBar();
      }
      
      if (saveBtn) {
        window.Utils.setButtonLoading(saveBtn, false);
      }
    }
  }

  // 프로젝트 이미지 삭제 (카테고리별)
  async deleteProjectImages(projectName, categoryName = null) {
    try {
      if (categoryName) {
        // 특정 카테고리의 이미지만 삭제
        await this.apiCall(`images.php?project=${encodeURIComponent(projectName)}&category=${encodeURIComponent(categoryName)}`, { 
          method: 'DELETE' 
        });
      } else {
        // 모든 카테고리의 이미지 삭제
        const response = await this.apiCall(`images.php?project=${encodeURIComponent(projectName)}`);
        const images = response.data;
        
        for (const category in images) {
          for (const image of images[category]) {
            await this.apiCall(`images.php?id=${image.id}`, { method: 'DELETE' });
          }
        }
        
        // 프로젝트 폴더 정리
        try {
          await fetch(`./api/clean_project.php?project=${encodeURIComponent(projectName)}`);
        } catch (cleanError) {
          console.log('폴더 정리 중 오류:', cleanError);
        }
      }
    } catch (error) {
      console.error('이미지 삭제 중 오류:', error);
    }
  }

  // 저장된 상태 불러오기 (서버 기반)
  async loadSavedState(stateName) {
    window.Utils.showProcessingMessage('상태를 불러오는 중...');
    window.Utils.showProgressBar(0);
    
    try {
      // 서버에서 프로젝트 정보 가져오기
      const projectsResponse = await this.apiCall('projects.php');
      const projects = projectsResponse.data;
      
      const project = projects.find(p => p.name === stateName);
      if (!project) {
        throw new Error('저장된 상태를 찾을 수 없습니다.');
      }
      
      // 기존 미리보기 데이터 초기화
      Object.keys(this.categoryManager.categoryData).forEach(cat => {
        if (this.categoryManager.categoryData[cat]) {
          this.categoryManager.categoryData[cat].previews.forEach(file => {
            window.selectedImages.delete(window.Utils.getImageKey(file));
          });
          this.categoryManager.categoryData[cat].previews = [];
          this.categoryManager.categoryData[cat].files = [];
        }
      });
      
      // 카테고리 구조 복원
      this.categoryManager.categories = project.categories || this.categoryManager.categories;
      this.categoryManager.categoryCounter = project.category_counter || this.categoryManager.categoryCounter;
      
      // 상태 복원
      window.thumbnailSize = project.thumbnail_size;
      window.selectedImages = new Set(project.selected_images || []);
      
      // post 데이터 복원
      if (project.post_data) {
        const postIframe = document.querySelector('iframe[src*="post"]');
        if (postIframe && postIframe.contentWindow) {
          try {
            // iframe에 메시지 전송
            postIframe.contentWindow.postMessage({
              type: 'RESTORE_POST_DATA',
              storeName: project.post_data.storeName || '',
              storeInfo: project.post_data.storeInfo || ''
            }, '*');
          } catch (e) {
            console.log('post 데이터 복원 실패:', e);
          }
        }
      }
      
      // UI 재구성
      this.categoryManager.renderCategories();
      
      // 서버에서 이미지 파일들 가져오기
      const imagesResponse = await this.apiCall(`images.php?project=${encodeURIComponent(stateName)}`);
      const categoryImages = imagesResponse.data;
      
      let totalFiles = 0;
      for (const category in categoryImages) {
        totalFiles += categoryImages[category].length;
      }
      
      let processedFiles = 0;
      
      // 이미지 파일들을 File 객체로 변환하여 복원
      for (const categoryName in categoryImages) {
        if (!this.categoryManager.categoryData[categoryName]) {
          this.categoryManager.categoryData[categoryName] = { files: [], previews: [] };
        }
        
        this.categoryManager.categoryData[categoryName].files = [];
        
        for (const imageInfo of categoryImages[categoryName]) {
          try {
            // 서버에서 이미지를 다운로드하여 File 객체로 변환
            // direct_url이 있으면 우선 사용, 없으면 url 사용
            let imageUrl = imageInfo.direct_url || imageInfo.url;
            
            // 상대 경로인 경우 절대 경로로 변환
            if (!imageUrl.startsWith('http')) {
              if (imageUrl.startsWith('/merge2/uploads/')) {
                imageUrl = window.location.origin + imageUrl;
              } else if (imageUrl.startsWith('/uploads/')) {
                imageUrl = window.location.origin + '/merge2' + imageUrl;
              } else if (imageUrl.startsWith('../uploads/')) {
                imageUrl = window.location.origin + '/merge2/uploads/' + imageUrl.substring(11);
              } else {
                imageUrl = window.location.origin + '/merge2/' + imageUrl;
              }
            }
            
            console.log('이미지 로드 시도:', imageUrl); // 디버깅용
            
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
              console.error('이미지 로드 실패:', imageUrl, imageResponse.status);
              continue;
            }
            const blob = await imageResponse.blob();
            const file = new File([blob], imageInfo.original_filename, { 
              type: imageInfo.mime_type || 'image/jpeg' 
            });
            
            this.categoryManager.categoryData[categoryName].files.push(file);
            
            // 해시 재생성
            const key = window.Utils.getImageKey(file);
            if (!window.imageHashes.has(key)) {
              window.imageHashes.set(key, await window.Utils.generateImageHash(file));
            }
            
            processedFiles++;
            window.Utils.showProgressBar((processedFiles / totalFiles) * 100);
            
            if (processedFiles % 15 === 0) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          } catch (fileError) {
            console.error(`파일 복원 중 오류:`, fileError);
            continue;
          }
        }
        
        // 파일 수 업데이트
        const wrapper = document.querySelector(`[data-category="${categoryName}"]`);
        if (wrapper) {
          const fileCountSpan = wrapper.querySelector(".file-count");
          if (fileCountSpan) {
            fileCountSpan.textContent = this.categoryManager.categoryData[categoryName].files.length;
          }
        }
      }
      
      // 미리보기 수 복원
      if (project.category_preview_counts) {
        this.categoryManager.categories.forEach(cat => {
          const wrapper = document.querySelector(`[data-category="${cat.name}"]`);
          if (wrapper && project.category_preview_counts[cat.name] !== undefined) {
            const previewInput = wrapper.querySelector("input[type=number]");
            if (previewInput) {
              previewInput.value = project.category_preview_counts[cat.name];
            }
          }
        });
      }
      
      // UI 업데이트
      if (document.getElementById("sizeSlider")) {
        document.getElementById("sizeSlider").value = window.thumbnailSize;
        document.getElementById("sizeValue").textContent = window.thumbnailSize + "px";
        this.updateThumbnailSize();
        this.categoryManager.updateSelectedCount();
        this.categoryManager.updatePreviewCountPopup();
      }
      
      window.Utils.hideProgressBar();
      window.Utils.showProcessingMessage(`"${stateName}" 상태를 불러왔습니다!`);
      
      // 현재 문서 상태 설정
      if (window.app) {
        window.app.currentDocumentName = stateName;
        localStorage.setItem('currentDocumentName', stateName);
        window.app.updateCurrentDocumentDisplay();
        
        // 저장 해시 초기화
        window.app.lastSaveHash = null;
        
        // 저장 입력폼에 현재 문서명 자동 입력
        const stateNameInput = document.getElementById("stateName");
        if (stateNameInput) {
          stateNameInput.value = stateName;
        }
      }
      
      // 저장된 상태 목록 갱신
      await this.loadSavedStatesList();
      
      // 프로젝트 불러오기 후 자동으로 빈 카테고리 채우기 실행
      setTimeout(() => {
        if (window.app && window.app.fillEmptyCategories) {
          window.app.fillEmptyCategories();
        }
      }, 1000);
      
    } catch (error) {
      console.error('불러오기 중 오류:', error);
      alert(`불러오기 중 오류가 발생했습니다: ${error.message}`);
      window.Utils.hideProgressBar();
    }
  }

  // 저장된 상태 목록 표시 (서버 기반)
  async loadSavedStatesList() {
    console.log('loadSavedStatesList 호출됨');
    const container = document.getElementById("savedStatesList");
    console.log('container element:', container);
    if (!container) {
      console.error('savedStatesList 컨테이너를 찾을 수 없습니다!');
      return;
    }

    // 기존 이벤트 리스너 정리
    this.cleanupEventListeners();
    
    try {
      console.log('API 호출 시작: projects.php');
      
      // 디버깅: forceEmptyState 값 확인
      console.log('forceEmptyState 값:', this.forceEmptyState);
      
      // 강제 빈 상태 설정이 활성화된 경우
      if (this.forceEmptyState) {
        console.log('강제 빈 상태 설정으로 인해 서버 접근을 건너뜀');
        container.innerHTML = '';
        
        // 신규 생성 버튼만 표시
        const newProjectDiv = document.createElement('div');
        newProjectDiv.className = 'saved-state-item';
        newProjectDiv.style.backgroundColor = '#e8f5e8';
        newProjectDiv.style.border = '2px solid #28a745';
        newProjectDiv.innerHTML = `
          <div>
            <span class="saved-state-name" style="color: #28a745; font-weight: bold;">🆕 새 프로젝트 생성</span>
            <span class="saved-state-time" style="color: #28a745;">새로운 작업 시작</span>
          </div>
          <div>
            <button onclick="app.stateManager.createNewProject()" style="background:#28a745; margin-right:8px; padding:6px 12px;">생성</button>
          </div>
        `;
        container.appendChild(newProjectDiv);
        
        const noStatesDiv = document.createElement('div');
        noStatesDiv.innerHTML = '<p style="color:#666; font-style:italic; text-align:center; padding:20px;">저장된 상태가 없습니다.</p>';
        container.appendChild(noStatesDiv);
        return;
      }
      
      // 서버에서 프로젝트 목록 가져오기
      console.log('apiCall 호출 전, apiBaseUrl:', this.apiBaseUrl);
      const response = await this.apiCall('projects.php');
      console.log('API 응답:', response);
      const projects = response.data || [];
      
      console.log('서버에서 가져온 projects:', projects);
      console.log('프로젝트 개수:', projects.length);
      
      // 컨테이너 초기화
      container.innerHTML = '';
      
      // 신규 생성 버튼은 항상 표시 (1번)
      const newProjectDiv = document.createElement('div');
      newProjectDiv.className = 'saved-state-item';
      newProjectDiv.style.backgroundColor = '#e8f5e8';
      newProjectDiv.style.border = '2px solid #28a745';
      newProjectDiv.innerHTML = `
        <div>
          <span class="saved-state-name" style="color: #28a745; font-weight: bold;">🆕 새 프로젝트 생성</span>
          <span class="saved-state-time" style="color: #28a745;">새로운 작업 시작</span>
        </div>
        <div>
          <button onclick="app.stateManager.createNewProject()" style="background:#28a745; margin-right:8px; padding:6px 12px;">생성</button>
        </div>
      `;
      container.appendChild(newProjectDiv);
       
      // 현재 문서가 있으면 2번에 표시
      if (window.app && window.app.currentDocumentName) {
        const currentDocumentDiv = document.createElement('div');
        currentDocumentDiv.className = 'saved-state-item';
        currentDocumentDiv.style.backgroundColor = '#f8f9fa';
        currentDocumentDiv.style.border = '2px solid #007bff';
        
        // 현재 편집 중인 문서의 크기 계산
        let currentFiles = 0;
        let currentSize = 0;
        
        if (window.app.categoryManager && window.app.categoryManager.categoryData) {
          Object.values(window.app.categoryManager.categoryData).forEach(categoryData => {
            if (categoryData && categoryData.files && Array.isArray(categoryData.files)) {
              currentFiles += categoryData.files.length;
              categoryData.files.forEach(file => {
                try {
                  if (file && file.size) {
                    currentSize += file.size;
                  }
                } catch (error) {
                  console.warn('현재 파일 크기 계산 중 오류:', error);
                }
              });
            }
          });
        }
        
        // 현재 프로젝트의 폴더명 찾기
        let currentHash = '';
        const currentProject = projects.find(p => p.name === window.app.currentDocumentName);
        if (currentProject && currentProject.folder_name) {
          currentHash = currentProject.folder_name;
        } else {
          // 폴더명이 없으면 직접 계산 (PHP의 md5와 동일한 방식)
          // 참고: 실제 폴더명은 서버에서 PHP의 md5() 함수로 생성됨
          currentHash = 'project_' + window.app.currentDocumentName.substring(0, 8).toLowerCase().replace(/[^a-z0-9]/g, '') + '...';
        }
        
        const currentSizeText = currentFiles > 0 ? ` | ${currentFiles}개 파일 | ${(currentSize / 1024 / 1024).toFixed(1)}MB` : ' | 빈 프로젝트';
        
        currentDocumentDiv.innerHTML = `
          <div>
            <span class="saved-state-name" style="color: #007bff; font-weight: bold;">✓ 현재: ${window.app.currentDocumentName}</span>
            <span class="saved-state-time" style="color: #007bff;">현재 편집 중${currentSizeText}</span>
            <span class="folder-hash">📁 ${currentHash}</span>
          </div>
          <div>
            <button onclick="app.stateManager.saveCurrentState()" style="background:#28a745; margin-right:8px; padding:6px 12px;">💾 저장</button>
            <button onclick="app.stateManager.loadSavedState('${window.app.currentDocumentName}')" style="background:#007bff; margin-right:8px; padding:6px 12px;">불러오기</button>
            <button onclick="app.stateManager.deleteCurrentProject()" style="background:#dc3545; padding:6px 12px;">삭제</button>
          </div>
        `;
        container.appendChild(currentDocumentDiv);
      }
      
      if (projects.length === 0) {
        const noStatesDiv = document.createElement('div');
        noStatesDiv.innerHTML = '<p style="color:#666; font-style:italic; text-align:center; padding:20px;">저장된 상태가 없습니다.</p>';
        container.appendChild(noStatesDiv);
        return;
      }
    
      // 검색 기능 추가
      const searchHtml = `
        <div style="margin-bottom: 15px;">
          <input type="text" id="stateSearchInput" placeholder="상태 이름으로 검색..." 
                 style="width: 200px; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px;">
        </div>
      `;
    
      // 페이지네이션 설정
      const itemsPerPage = 10;
      const currentPage = parseInt(localStorage.getItem('savedStatesCurrentPage') || '1');
      const searchTerm = localStorage.getItem('savedStatesSearchTerm') || '';
      
      // 검색 필터링
      let filteredProjects = projects;
      if (searchTerm) {
        filteredProjects = projects.filter(project => 
          project.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const currentProjects = filteredProjects.slice(startIndex, endIndex);
      
      // 검색 입력창 추가
      const searchDiv = document.createElement('div');
      searchDiv.innerHTML = searchHtml;
      container.appendChild(searchDiv);
      
      // 상태 목록 표시 (현재 문서 제외)
      currentProjects.forEach(project => {
        // 현재 문서는 이미 위에서 표시했으므로 건너뛰기
        if (window.app && window.app.currentDocumentName === project.name) {
          return;
        }
        
        const div = document.createElement('div');
        div.className = 'saved-state-item';
        
        // 파일 개수와 용량 표시 (서버에서 계산됨)
        const totalFiles = project.image_count || 0;
        const totalSize = project.total_size || 0;
        
        // 프로젝트 폴더명 (서버에서 계산된 값 사용, 없으면 직접 계산)
        let projectHash = project.folder_name || '';
        if (!projectHash) {
          // 폴더명이 없으면 직접 계산
          projectHash = this.getProjectFolderName(project.name);
        }
        
        console.log('프로젝트:', project.name, '파일 개수:', totalFiles, '총 크기:', totalSize);
        
        const sizeText = totalFiles > 0 ? ` | ${totalFiles}개 파일 | ${(totalSize / 1024 / 1024).toFixed(1)}MB` : ' | 빈 프로젝트';
        
        // 업데이트 시간 포맷팅
        const updateTime = new Date(project.updated_at).toLocaleString();
        
        div.innerHTML = `
          <div>
            <span class="saved-state-name">${project.name}</span>
            <span class="saved-state-time">${updateTime}${sizeText}</span>
            <span class="folder-hash">📁 ${projectHash}</span>
          </div>
          <div>
            <button onclick="app.stateManager.loadSavedState('${project.name}')" style="background:#28a745; margin-right:8px; padding:6px 12px;">불러오기</button>
            <button onclick="app.stateManager.deleteSavedState('${project.name}')" class="delete-state-btn">삭제</button>
          </div>
        `;
        
        container.appendChild(div);
      });
    
      // 페이지네이션 추가
      if (totalPages > 1) {
        const paginationDiv = document.createElement('div');
        paginationDiv.style.cssText = 'margin-top: 15px; text-align: center;';
        
        let paginationHtml = '';
        
        // 이전 페이지 버튼
        if (currentPage > 1) {
          paginationHtml += `<button onclick="app.stateManager.changeSavedStatesPage(${currentPage - 1})" style="margin: 0 5px; padding: 5px 10px;">이전</button>`;
        }
        
        // 페이지 번호
        for (let i = 1; i <= totalPages; i++) {
          if (i === currentPage) {
            paginationHtml += `<button style="margin: 0 5px; padding: 5px 10px; background: var(--button-bg); color: white;">${i}</button>`;
          } else {
            paginationHtml += `<button onclick="app.stateManager.changeSavedStatesPage(${i})" style="margin: 0 5px; padding: 5px 10px;">${i}</button>`;
          }
        }
        
        // 다음 페이지 버튼
        if (currentPage < totalPages) {
          paginationHtml += `<button onclick="app.stateManager.changeSavedStatesPage(${currentPage + 1})" style="margin: 0 5px; padding: 5px 10px;">다음</button>`;
        }
        
        paginationDiv.innerHTML = paginationHtml;
        container.appendChild(paginationDiv);
      }
    
      // 검색 이벤트 리스너 추가
      const searchInput = document.getElementById('stateSearchInput');
      if (searchInput) {
        searchInput.value = searchTerm;
        
        // 기존 이벤트 리스너 제거 (중복 방지)
        searchInput.removeEventListener('blur', this.searchBlurHandler);
        searchInput.removeEventListener('keydown', this.searchKeydownHandler);
        
        // blur 이벤트 (입력폼에서 포커스가 빠져나갈 때)
        this.searchBlurHandler = (e) => {
          localStorage.setItem('savedStatesSearchTerm', e.target.value);
          localStorage.setItem('savedStatesCurrentPage', '1');
          this.loadSavedStatesList();
        };
        
        // Enter 키 이벤트 (엔터를 눌렀을 때)
        this.searchKeydownHandler = (e) => {
          if (e.key === 'Enter') {
            localStorage.setItem('savedStatesSearchTerm', e.target.value);
            localStorage.setItem('savedStatesCurrentPage', '1');
            this.loadSavedStatesList();
            e.target.blur(); // 포커스 해제
          }
        };
        
        searchInput.addEventListener('blur', this.searchBlurHandler);
        searchInput.addEventListener('keydown', this.searchKeydownHandler);
      }
    } catch (error) {
      console.error('상태 목록 로드 중 오류:', error);
      console.error('오류 스택:', error.stack);
      container.innerHTML = '<p style="color:#666; font-style:italic;">상태 목록을 불러오는 중 오류가 발생했습니다.</p>';
      
      // 디버깅을 위해 직접 fetch 시도
      console.log('직접 fetch 시도...');
      try {
        const directResponse = await fetch('./api/projects.php');
        const directText = await directResponse.text();
        console.log('직접 fetch 응답:', directText.substring(0, 200));
      } catch (fetchError) {
        console.error('직접 fetch 실패:', fetchError);
      }
    }
  }

  // 페이지 변경
  changeSavedStatesPage(page) {
    localStorage.setItem('savedStatesCurrentPage', page.toString());
    this.loadSavedStatesList();
  }

  // 저장된 상태 삭제 (서버 기반)
  async deleteSavedState(stateName) {
    if (confirm(`"${stateName}" 상태를 삭제하시겠습니까?\n\n서버에 저장된 모든 이미지와 폴더가 함께 삭제됩니다.`)) {
      try {
        // 프로젝트 삭제 전에 폴더 정리
        await fetch(`./api/clean_project.php?project=${encodeURIComponent(stateName)}`);
        
        // 프로젝트 삭제
        await this.apiCall(`projects.php?name=${encodeURIComponent(stateName)}`, {
          method: 'DELETE'
        });
        
        await this.loadSavedStatesList();
        window.Utils.showProcessingMessage(`"${stateName}" 상태가 삭제되었습니다.`);
      } catch (error) {
        console.error('삭제 중 오류:', error);
        alert('삭제 중 오류가 발생했습니다.');
      }
    }
  }

  // 설정 저장/불러오기
  saveSettings() {
    const settings = {
      categories: this.categoryManager.categories,
      thumbnailSize: window.thumbnailSize,
      isDarkMode: window.isDarkMode,
      categoryCounter: this.categoryManager.categoryCounter
    };
    localStorage.setItem('photoClassifierSettings', JSON.stringify(settings));
  }

  loadSettings() {
    const saved = localStorage.getItem('photoClassifierSettings');
    if (saved) {
      const settings = JSON.parse(saved);
      
      // 카테고리 정보는 불러오지 않음 (빈 프로젝트로 시작)
      // if (settings.categories) {
      //   this.categoryManager.categories = settings.categories;
      //   this.categoryManager.categoryCounter = settings.categoryCounter || this.categoryManager.categories.length;
      // }
      
      // UI 설정만 불러오기
      window.thumbnailSize = settings.thumbnailSize || 100;
      window.isDarkMode = settings.isDarkMode || false;
      
      // 카테고리 초기화 (빈 상태로)
      this.categoryManager.categories = [];
      this.categoryManager.categoryData = {};
      this.categoryManager.categoryCounter = 0;
    }
  }

  // 썸네일 크기 업데이트
  updateThumbnailSize() {
    const images = document.querySelectorAll('.preview-container img, #finalPreview img');
    images.forEach(img => {
      img.style.width = window.thumbnailSize + 'px';
      img.style.height = window.thumbnailSize + 'px';
    });
    
    const addButtons = document.querySelectorAll('.add-item');
    addButtons.forEach(btn => {
      btn.style.width = window.thumbnailSize + 'px';
      btn.style.height = window.thumbnailSize + 'px';
    });
  }

  // 자동저장 트리거
  triggerAutoSave() {
    console.log('StateManager 자동저장 트리거 요청 무시됨 (시간 기반 자동저장만 활성)');
  }

  // 새 프로젝트 생성 (서버 기반)
  async createNewProject() {
    const projectName = prompt('새 프로젝트 이름을 입력하세요:');
    if (projectName && projectName.trim()) {
      try {
        // 프로젝트 이름 유효성 검사
        const trimmedName = projectName.trim();
        if (trimmedName.length === 0) {
          alert('프로젝트 이름을 입력해주세요.');
          return;
        }
        
        // 기존 데이터 초기화
        this.categoryManager.categoryData = {};
        window.selectedImages = new Set();
        
        // 기본 카테고리 2개 추가
        this.categoryManager.categories = [
          { name: "외부", defaultCount: 5, enabled: true },
          { name: "내부", defaultCount: 6, enabled: true }
        ];
        this.categoryManager.categoryCounter = 2;
        
        // 기본 카테고리 데이터 초기화
        this.categoryManager.categories.forEach(cat => {
          this.categoryManager.categoryData[cat.name] = { files: [], previews: [] };
        });
        
        // UI 초기화
        this.categoryManager.renderCategories();
        this.categoryManager.updateSelectedCount();
        this.categoryManager.updatePreviewCountPopup();
        
        // 빈 상태를 서버에 저장하여 리스트에 추가
        const emptyProjectData = {
          name: trimmedName,
          categories: this.categoryManager.categories,
          category_preview_counts: {
            "외부": 5,
            "내부": 6
          },
          selected_images: [],
          thumbnail_size: window.thumbnailSize,
          category_counter: this.categoryManager.categoryCounter
        };
        
        console.log('프로젝트 생성 요청:', emptyProjectData);
        
        const response = await this.apiCall('projects.php', {
          method: 'POST',
          body: JSON.stringify(emptyProjectData)
        });
        
        console.log('프로젝트 생성 응답:', response);
        
        // 현재 문서명 설정 (서버 저장 성공 후)
        if (window.app) {
          window.app.currentDocumentName = trimmedName;
          localStorage.setItem('currentDocumentName', trimmedName);
          window.app.updateCurrentDocumentDisplay();
          
          // 저장 해시 초기화
          window.app.lastSaveHash = null;
          
          // 저장 입력폼에 프로젝트명 입력
          const stateNameInput = document.getElementById("stateName");
          if (stateNameInput) {
            stateNameInput.value = trimmedName;
          }
        }
        
        // 저장된 상태 목록 갱신
        await this.loadSavedStatesList();
        
        window.Utils.showProcessingMessage(`새 프로젝트 "${trimmedName}"가 생성되었습니다.`);
      } catch (error) {
        console.error('새 프로젝트 생성 중 오류:', error);
        alert(`새 프로젝트 생성 중 오류가 발생했습니다.\n\n${error.message}`);
        
        // 오류 발생 시 UI 복구
        if (window.app) {
          window.app.currentDocumentName = null;
          localStorage.removeItem('currentDocumentName');
          window.app.updateCurrentDocumentDisplay();
        }
      }
    }
  }

  // 현재 프로젝트 삭제 (서버 기반)
  async deleteCurrentProject() {
    if (!window.app || !window.app.currentDocumentName) {
      alert('삭제할 현재 프로젝트가 없습니다.');
      return;
    }

    if (confirm(`"${window.app.currentDocumentName}" 프로젝트를 삭제하시겠습니까?\n\n서버에 저장된 모든 이미지와 폴더가 함께 삭제됩니다.`)) {
      try {
        const projectName = window.app.currentDocumentName;
        
        // 프로젝트 삭제 전에 폴더 정리
        await fetch(`./api/clean_project.php?project=${encodeURIComponent(projectName)}`);
        
        // 서버에서 프로젝트 삭제
        await this.apiCall(`projects.php?name=${encodeURIComponent(projectName)}`, {
          method: 'DELETE'
        });
        
        // 현재 프로젝트 상태 초기화
        window.app.currentDocumentName = null;
        localStorage.removeItem('currentDocumentName');
        window.app.updateCurrentDocumentDisplay();
        
        // 저장 해시 초기화
        window.app.lastSaveHash = null;
        
        // 새 프로젝트 상태로 복귀
        window.app.showNewProjectMessage();
        
        // 저장된 상태 목록 갱신
        await this.loadSavedStatesList();
        
        window.Utils.showProcessingMessage(`"${projectName}" 프로젝트가 삭제되었습니다.`);
      } catch (error) {
        console.error('프로젝트 삭제 중 오류:', error);
        alert('프로젝트 삭제 중 오류가 발생했습니다.');
      }
    }
  }

  // 이벤트 리스너 정리 메서드
  cleanupEventListeners() {
    if (this.searchBlurHandler) {
      const searchInput = document.getElementById('stateSearchInput');
      if (searchInput) {
        searchInput.removeEventListener('blur', this.searchBlurHandler);
        searchInput.removeEventListener('keydown', this.searchKeydownHandler);
      }
    }
  }

  // 클래스 소멸자 (메모리 정리)
  destroy() {
    this.cleanupEventListeners();
    if (this.categoryManager) {
      this.categoryManager = null;
    }
  }

  // 모든 저장된 상태 삭제 (서버 기반)
  async clearAllSavedStates() {
    try {
      // 모든 프로젝트 목록 가져오기
      const response = await this.apiCall('projects.php');
      const projects = response.data || [];
      
      // 각 프로젝트를 개별적으로 삭제
      for (const project of projects) {
        await this.apiCall(`projects.php?name=${encodeURIComponent(project.name)}`, {
          method: 'DELETE'
        });
      }
      
      console.log('모든 저장된 상태가 삭제되었습니다.');
      
      // 캐시 초기화를 위한 타임스탬프 설정
      this.lastCacheClear = Date.now();
      this.lastLoadTime = 0;
      
    } catch (error) {
      console.error('저장된 상태 삭제 중 오류:', error);
      throw error;
    }
  }

  // 데이터베이스 초기화 (개발용)
  async initializeDatabase() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/init_db.php`);
      const data = await response.json();
      
      if (data.success) {
        console.log('데이터베이스 초기화 완료');
        return true;
      } else {
        console.error('데이터베이스 초기화 실패:', data.message);
        return false;
      }
    } catch (error) {
      console.error('데이터베이스 초기화 중 오류:', error);
      return false;
    }
  }
}

// StateManager를 전역 객체로 등록
window.StateManager = StateManager;
