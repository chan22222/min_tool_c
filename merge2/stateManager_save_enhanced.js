// StateManager 개선 - post 데이터 저장 지원
(function() {
  // 원래 saveCurrentStateInternal 함수 저장
  const originalSaveCurrentStateInternal = window.StateManager.prototype.saveCurrentStateInternal;
  
  // saveCurrentStateInternal 함수 오버라이드
  window.StateManager.prototype.saveCurrentStateInternal = async function(stateName, isAutoSave = false, saveBtn = null) {
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
        // postMessage로 데이터 요청하고 응답 대기
        postData = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.log('post 데이터 수집 타임아웃');
            resolve({});
          }, 1000);
          
          const listener = (event) => {
            if (event.data.type === 'POST_DATA_RESPONSE') {
              clearTimeout(timeout);
              window.removeEventListener('message', listener);
              resolve({
                storeName: event.data.storeName || '',
                storeInfo: event.data.storeInfo || ''
              });
            }
          };
          
          window.addEventListener('message', listener);
          postIframe.contentWindow.postMessage({ type: 'REQUEST_POST_DATA' }, '*');
        });
        
        console.log('수집된 post 데이터:', postData);
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
  };
  
  console.log('StateManager post_data 저장 기능이 활성화되었습니다');
})();