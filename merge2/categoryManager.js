// CategoryManager 클래스
window.CategoryManager = class CategoryManager {
  constructor() {
    this.categories = [
      { name: "외부", defaultCount: 5, enabled: true },
      { name: "내부", defaultCount: 6, enabled: true },
      { name: "기본 상차림", defaultCount: 2, enabled: true },
      { name: "메뉴판", defaultCount: 2, enabled: true },
      { name: "본 메뉴1", defaultCount: 3, enabled: true },
      { name: "본 메뉴2", defaultCount: 3, enabled: true }
    ];
    this.categoryData = {};
    this.categoryCounter = this.categories.length;
    
    // Sortable 인스턴스 추적
    this.sortableInstances = new Map();
  }

  addNewCategory() {
    this.categoryCounter++;
    const newCategory = {
      name: `카테고리 ${this.categoryCounter}`,
      defaultCount: 1,
      enabled: true
    };
    this.categories.push(newCategory);
    this.categoryData[newCategory.name] = { files: [], previews: [] };
    
    this.addSingleCategory(newCategory);
    this.updatePreviewCountPopup();
    
    this.saveSettings();
    this.triggerAutoSave();
    window.Utils.showProcessingMessage('새 카테고리가 추가되었습니다!');
  }

  insertCategoryAt(categoryName, position = 'before') {
    this.categoryCounter++;
    const newCategory = {
      name: `카테고리 ${this.categoryCounter}`,
      defaultCount: 1,
      enabled: true
    };
    
    const index = this.categories.findIndex(cat => cat.name === categoryName);
    if (index !== -1) {
      if (position === 'before') {
        // 카테고리 사이: 해당 카테고리 앞에 삽입
        this.categories.splice(index, 0, newCategory);
        window.Utils.showProcessingMessage(`새 카테고리가 "${categoryName}" 앞에 추가되었습니다!`);
      } else {
        // 기타: 해당 카테고리 뒤에 삽입
        this.categories.splice(index + 1, 0, newCategory);
        window.Utils.showProcessingMessage(`새 카테고리가 "${categoryName}" 뒤에 추가되었습니다!`);
      }
    } else {
      // 찾지 못하면 맨 뒤에 추가
      this.categories.push(newCategory);
      window.Utils.showProcessingMessage('새 카테고리가 맨 뒤에 추가되었습니다!');
    }
    
    this.categoryData[newCategory.name] = { files: [], previews: [] };
    
    this.addSingleCategoryAtPosition(newCategory, index, position);
    this.updatePreviewCountPopup();
    
    this.saveSettings();
    this.triggerAutoSave();
  }

  deleteCategory(categoryName) {
    // 카테고리가 2개 이하일 때 삭제 방지
    if (this.categories.length <= 2) {
      alert('카테고리는 최소 2개 이상 유지해야 합니다!');
      return;
    }
    
    if (confirm(`"${categoryName}" 카테고리를 삭제하시겠습니까?`)) {
      const categoryIndex = this.categories.findIndex(cat => cat.name === categoryName);
      if (categoryIndex !== -1) {
        this.categories.splice(categoryIndex, 1);
      }
      
      if (this.categoryData[categoryName]) {
        this.categoryData[categoryName].previews.forEach(file => {
          window.selectedImages.delete(window.Utils.getImageKey(file));
        });
        delete this.categoryData[categoryName];
      }
      
      this.renderCategories();
      this.saveSettings();
      this.updateSelectedCount();
      this.updatePreviewCountPopup();
      this.triggerAutoSave();
      window.Utils.showProcessingMessage('카테고리가 삭제되었습니다!');
    }
  }

  async clearCategory(categoryName) {
    if (confirm(`"${categoryName}" 카테고리의 모든 파일과 미리보기를 초기화하시겠습니까?\n\n서버에 저장된 이미지도 함께 삭제됩니다.`)) {
      if (this.categoryData[categoryName]) {
        // 서버에서 해당 카테고리의 이미지 삭제 (현재 프로젝트가 있는 경우)
        if (window.app && window.app.currentDocumentName) {
          try {
            window.Utils.showProcessingMessage(`서버에서 ${categoryName} 이미지 삭제 중...`);
            
            const response = await fetch(`./api/images.php?project=${encodeURIComponent(window.app.currentDocumentName)}&category=${encodeURIComponent(categoryName)}`, {
              method: 'DELETE'
            });
            
            const data = await response.json();
            if (data.success) {
              console.log(`서버에서 ${data.data.deleted_count}개 이미지 삭제됨`);
            }
          } catch (error) {
            console.error('서버 이미지 삭제 중 오류:', error);
          }
        }
        
        // 미리보기에서 선택된 이미지 제거
        this.categoryData[categoryName].previews.forEach(file => {
          window.selectedImages.delete(window.Utils.getImageKey(file));
        });
        
        // 파일과 미리보기 초기화
        this.categoryData[categoryName].files = [];
        this.categoryData[categoryName].previews = [];
        
        // 파일 입력 초기화
        const wrapper = document.querySelector(`[data-category="${categoryName}"]`);
        if (wrapper) {
          const fileInput = wrapper.querySelector('input[type="file"]');
          if (fileInput) {
            fileInput.value = '';
          }
          
          const fileCountSpan = wrapper.querySelector('.file-count');
          if (fileCountSpan) {
            fileCountSpan.textContent = '0';
          }
          
          const previewContainer = wrapper.querySelector('.preview-container');
          if (previewContainer) {
            previewContainer.innerHTML = '';
          }
        }
      }
      
      this.saveSettings();
      this.updateSelectedCount();
      this.updatePreviewCountPopup();
      this.triggerAutoSave();
      window.Utils.showProcessingMessage(`${categoryName} 카테고리가 초기화되었습니다!`);
    }
  }

  updateCategoryName(oldName, newName) {
    if (oldName === newName) return;
    
    // 빈 이름 방지
    if (!newName || newName.trim() === '') {
      alert('카테고리 이름을 비워둘 수 없습니다!');
      // 이전 이름으로 되돌리기
      const wrapper = document.querySelector(`[data-category="${oldName}"]`);
      if (wrapper) {
        const nameInput = wrapper.querySelector('.category-name-input');
        if (nameInput) {
          nameInput.value = oldName;
        }
      }
      return;
    }
    
    if (this.categories.some(cat => cat.name === newName && cat.name !== oldName)) {
      alert('이미 존재하는 카테고리 이름입니다!');
      // 이전 이름으로 되돌리기
      const wrapper = document.querySelector(`[data-category="${oldName}"]`);
      if (wrapper) {
        const nameInput = wrapper.querySelector('.category-name-input');
        if (nameInput) {
          nameInput.value = oldName;
        }
      }
      return;
    }
    
    // 카테고리 배열에서 이름 업데이트
    const categoryIndex = this.categories.findIndex(cat => cat.name === oldName);
    if (categoryIndex !== -1) {
      this.categories[categoryIndex].name = newName;
    }
    
    // 카테고리 데이터 이동 (키 변경)
    if (this.categoryData[oldName]) {
      this.categoryData[newName] = { ...this.categoryData[oldName] };
      delete this.categoryData[oldName];
    }
    
    // Sortable 인스턴스 이동
    if (this.sortableInstances.has(oldName)) {
      const instance = this.sortableInstances.get(oldName);
      this.sortableInstances.delete(oldName);
      this.sortableInstances.set(newName, instance);
    }
    
    // 전체 카테고리 다시 렌더링하여 DOM 요소와 이벤트 핸들러 갱신
    this.renderCategories();
    
    this.saveSettings();
    this.updatePreviewCountPopup();
    this.triggerAutoSave();
    
    window.Utils.showProcessingMessage(`카테고리 이름이 "${oldName}"에서 "${newName}"으로 변경되었습니다!`);
  }

  toggleCategoryEnabled(categoryName) {
    const categoryIndex = this.categories.findIndex(cat => cat.name === categoryName);
    if (categoryIndex !== -1) {
      this.categories[categoryIndex].enabled = !this.categories[categoryIndex].enabled;
      const wrapper = document.querySelector(`[data-category="${categoryName}"]`);
      if (wrapper) {
        if (this.categories[categoryIndex].enabled) {
          wrapper.classList.remove('disabled');
        } else {
          wrapper.classList.add('disabled');
        }
      }
      this.saveSettings();
      this.updatePreviewCountPopup();
      this.triggerAutoSave();
    }
  }

  toggleCategory(categoryName) {
    const wrapper = document.querySelector(`[data-category="${categoryName}"]`);
    if (wrapper) {
      wrapper.classList.toggle('collapsed');
      
      const btn = wrapper.querySelector('.collapse-btn');
      if (wrapper.classList.contains('collapsed')) {
        btn.textContent = '▼';
      } else {
        btn.textContent = '▲';
      }
      
      this.updatePreviewCountPopup();
    }
  }

  saveSettings() {
    const settings = {
      categories: this.categories,
      categoryCounter: this.categoryCounter
    };
    localStorage.setItem('photoClassifierSettings', JSON.stringify(settings));
  }

  loadSettings() {
    // 빈 프로젝트로 시작하므로 설정을 불러오지 않음
    // const saved = localStorage.getItem('photoClassifierSettings');
    // if (saved) {
    //   const settings = JSON.parse(saved);
    //   
    //   if (settings.categories) {
    //     this.categories = settings.categories;
    //     this.categoryCounter = settings.categoryCounter || this.categories.length;
    //   }
    //   
    //   this.categories.forEach(cat => {
    //     if (!this.categoryData[cat.name]) {
    //       this.categoryData[cat.name] = { files: [], previews: [] };
    //     }
    //   });
    // }
    
    // 항상 빈 상태로 초기화
    this.categories = [];
    this.categoryData = {};
    this.categoryCounter = 0;
  }

  updateSelectedCount() {
    const countElement = document.getElementById("selectedCount");
    if (countElement) {
      countElement.textContent = window.selectedImages.size;
    } else {
      console.warn('selectedCount 요소를 찾을 수 없습니다.');
    }
  }

  updatePreviewCountPopup() {
    const popup = document.getElementById('preview-count-popup');
    const list = document.getElementById('preview-count-list');
    
    if (!popup || !list) {
      console.warn('미리보기 카운트 팝업 요소를 찾을 수 없습니다.');
      return;
    }
    
    let totalPreviews = 0;
    let html = '';
    
    this.categories.forEach(cat => {
      if (cat.enabled) {
        const count = this.categoryData[cat.name] ? this.categoryData[cat.name].previews.length : 0;
        totalPreviews += count;
        html += `<div style="margin: 5px 0; display: flex; justify-content: space-between;">
          <span>${cat.name}:</span>
          <strong>${count}개</strong>
        </div>`;
      }
    });
    
    html += `<hr style="margin: 10px 0; border: 1px solid var(--border-color);">`;
    html += `<div style="display: flex; justify-content: space-between; font-weight: bold; color: var(--button-bg);">
      <span>총합:</span>
      <span>${totalPreviews}개</span>
    </div>`;
    
    list.innerHTML = html;
  }

  // 카테고리 렌더링
  renderCategories() {
    // 기존 미리보기 데이터와 Sortable 인스턴스 백업
    const existingPreviews = {};
    const existingSortableInstances = new Map();
    
    this.categories.forEach(cat => {
      if (this.categoryData[cat.name] && this.categoryData[cat.name].previews) {
        existingPreviews[cat.name] = [...this.categoryData[cat.name].previews];
      }
      
      // 기존 Sortable 인스턴스 백업 및 정리
      if (this.sortableInstances.has(cat.name)) {
        const instance = this.sortableInstances.get(cat.name);
        existingSortableInstances.set(cat.name, instance);
        if (instance && instance.destroy) {
          instance.destroy();
        }
      }
    });
    
    // 모든 Sortable 인스턴스 맵 초기화
    this.sortableInstances.clear();

    const categoriesContainer = document.getElementById("categories");
    categoriesContainer.innerHTML = '';
    
    this.categories.forEach((cat, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "category";
      if (!cat.enabled) {
        wrapper.classList.add('disabled');
      }
      wrapper.setAttribute("data-category", cat.name);
      
      const fileCount = this.categoryData[cat.name] ? this.categoryData[cat.name].files.length : 0;
      const previewCount = this.categoryData[cat.name] ? this.categoryData[cat.name].previews.length : 0;

      wrapper.innerHTML = `
        <div class="category-header">
          <div class="category-title">
            <input type="checkbox" class="category-checkbox" 
                   ${cat.enabled ? 'checked' : ''} 
                   onchange="app.categoryManager.toggleCategoryEnabled('${cat.name}')">
            <input type="text" class="category-name-input" value="${cat.name}" 
                   data-original-name="${cat.name}"
                   onkeypress="if(event.key==='Enter') this.blur()">
            <small style="color:#666;">업로드: <span class="file-count">${fileCount}</span>개</small>
            <span class="uploading-indicator" style="display:none;">업로드 중...</span>
          </div>
          <div class="category-controls">
            <button class="collapse-btn" onclick="app.categoryManager.toggleCategory('${cat.name}')">▲</button>
            <button class="delete-category-btn" onclick="app.categoryManager.deleteCategory('${cat.name}')">✕</button>
          </div>
        </div>
        <div class="category-content">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <input type="file" multiple accept="image/*" data-name="${cat.name}" />
            <button class="clear-category-btn" onclick="app.categoryManager.clearCategory('${cat.name}')" style="background:#dc3545; padding: 8px 12px;">🗑️ 초기화</button>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <label><strong>미리보기 수:</strong></label>
            <button class="decrease" style="padding: 4px 8px;">-</button>
            <input type="number" value="${previewCount || cat.defaultCount}" min="0" style="width: 60px; text-align: center;" />
            <button class="increase" style="padding: 4px 8px;">+</button>
            <button class="load-btn" style="background:#28a745;">🔄 불러오기</button>
          </div>
          <div class="preview-container"></div>
        </div>
      `;
      
      // 카테고리 사이에 구분선과 삽입 영역 추가 (첫 번째 카테고리 제외)
      if (index > 0) {
        const divider = document.createElement("div");
        divider.className = "category-divider";
        wrapper.appendChild(divider);
        
        const gapInsertZone = document.createElement("div");
        gapInsertZone.className = "category-gap-insert-zone";
        gapInsertZone.onclick = () => this.insertCategoryAt(cat.name, 'before');
        divider.appendChild(gapInsertZone);
      }
      
      categoriesContainer.appendChild(wrapper);

      // 카테고리 데이터 초기화 (없는 경우)
      if (!this.categoryData[cat.name]) {
        this.categoryData[cat.name] = { files: [], previews: [] };
      }

      // 기존 미리보기 데이터 복원
      if (existingPreviews[cat.name] && existingPreviews[cat.name].length > 0) {
        this.categoryData[cat.name].previews = [...existingPreviews[cat.name]];
        setTimeout(() => {
          this.displayPreviews(cat.name, this.categoryData[cat.name].previews);
        }, 100);
      }

      // 이벤트 설정
      this.setupCategoryEvents(wrapper, cat.name);
    });

    // 카테고리 정렬 기능 설정
    this.setupCategorySorting();
  }

  // 단일 카테고리 추가 (맨 뒤)
  addSingleCategory(newCategory) {
    const categoriesContainer = document.getElementById("categories");
    const wrapper = this.createCategoryElement(newCategory);
    categoriesContainer.appendChild(wrapper);
    this.setupCategoryEvents(wrapper, newCategory.name);
  }

  // 단일 카테고리 추가 (특정 위치)
  addSingleCategoryAtPosition(newCategory, targetIndex, position) {
    const categoriesContainer = document.getElementById("categories");
    const wrapper = this.createCategoryElement(newCategory);
    
    const targetElement = categoriesContainer.children[targetIndex];
    if (position === 'before') {
      categoriesContainer.insertBefore(wrapper, targetElement);
    } else {
      categoriesContainer.insertBefore(wrapper, targetElement.nextSibling);
    }
    
    this.setupCategoryEvents(wrapper, newCategory.name);
    // 전체 카테고리를 다시 렌더링하여 구분선 정리
    this.renderCategories();
  }

  // 카테고리 요소 생성
  createCategoryElement(cat) {
    const wrapper = document.createElement("div");
    wrapper.className = "category";
    if (!cat.enabled) {
      wrapper.classList.add('disabled');
    }
    wrapper.setAttribute("data-category", cat.name);
    
    const fileCount = this.categoryData[cat.name] ? this.categoryData[cat.name].files.length : 0;
    const previewCount = this.categoryData[cat.name] ? this.categoryData[cat.name].previews.length : 0;

    wrapper.innerHTML = `
      <div class="category-header">
        <div class="category-title">
          <input type="checkbox" class="category-checkbox" 
                 ${cat.enabled ? 'checked' : ''} 
                 onchange="app.categoryManager.toggleCategoryEnabled('${cat.name}')">
          <input type="text" class="category-name-input" value="${cat.name}" 
                 data-original-name="${cat.name}"
                 onkeypress="if(event.key==='Enter') this.blur()">
          <small style="color:#666;">업로드: <span class="file-count">${fileCount}</span>개</small>
          <span class="uploading-indicator" style="display:none;">업로드 중...</span>
        </div>
        <div class="category-controls">
          <button class="collapse-btn" onclick="app.categoryManager.toggleCategory('${cat.name}')">▲</button>
          <button class="delete-category-btn" onclick="app.categoryManager.deleteCategory('${cat.name}')">✕</button>
        </div>
      </div>
      <div class="category-content">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <input type="file" multiple accept="image/*" data-name="${cat.name}" />
          <button class="clear-category-btn" onclick="app.categoryManager.clearCategory('${cat.name}')" style="background:#dc3545; padding: 8px 12px;">🗑️ 초기화</button>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <label><strong>미리보기 수:</strong></label>
          <button class="decrease" style="padding: 4px 8px;">-</button>
          <input type="number" value="${previewCount || cat.defaultCount}" min="0" style="width: 60px; text-align: center;" />
          <button class="increase" style="padding: 4px 8px;">+</button>
          <button class="load-btn" style="background:#28a745;">🔄 불러오기</button>
        </div>
        <div class="preview-container"></div>
      </div>
    `;
    
    return wrapper;
  }


  // 카테고리 드래그 정렬 설정
  setupCategorySorting() {
    const categoriesContainer = document.getElementById("categories");
    new Sortable(categoriesContainer, {
      handle: '.category-header',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: (evt) => {
        const movedCategory = this.categories.splice(evt.oldIndex, 1)[0];
        this.categories.splice(evt.newIndex, 0, movedCategory);
        this.saveSettings();
        this.updatePreviewCountPopup();
        
        // 카테고리 이동 후 전체 렌더링하여 구분선 정리
        setTimeout(() => {
          this.renderCategories();
        }, 100);
      }
    });
  }

  // 카테고리 이벤트 설정
  setupCategoryEvents(wrapper, categoryName) {
    const input = wrapper.querySelector("input[type=file]");
    const previewInput = wrapper.querySelector("input[type=number]");
    const loadBtn = wrapper.querySelector(".load-btn");
    const fileCountSpan = wrapper.querySelector(".file-count");
    const uploadingIndicator = wrapper.querySelector(".uploading-indicator");
    const nameInput = wrapper.querySelector(".category-name-input");

    // 카테고리 이름 변경 이벤트 리스너 추가
    if (nameInput) {
      nameInput.addEventListener('blur', (e) => {
        const originalName = e.target.getAttribute('data-original-name') || categoryName;
        const newName = e.target.value.trim();
        this.updateCategoryName(originalName, newName);
      });
      
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.target.blur();
        }
      });
    }

    // 파일 업로드 (원본과 압축본 분리 저장)
    input.addEventListener("change", async e => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      if (!uploadingIndicator || !loadBtn) {
        console.error('필수 UI 요소를 찾을 수 없습니다.');
        window.Utils.showProcessingMessage('업로드 UI 요소를 찾을 수 없습니다.');
        return;
      }

      uploadingIndicator.style.display = 'inline-block';
      uploadingIndicator.textContent = `업로드 중... (0/${files.length})`;
      window.Utils.setButtonLoading(loadBtn, true);

      try {
        if (!this.categoryData[categoryName].files) {
          this.categoryData[categoryName].files = [];
        }
        
        // 업로드 최적화 설정에 따른 배치 크기 조절
        const batchSize = window.uploadOptimizations.batch ? window.uploadOptimizations.batchSize : Math.min(window.uploadOptimizations.batchSize * 1.5, 50);
        const delay = window.uploadOptimizations.memory ? 20 : 15;
        
        for (let i = 0; i < files.length; i += batchSize) {
          const batch = files.slice(i, i + batchSize);
          
          for (const originalFile of batch) {
            // 중복 파일 감지가 활성화된 경우
            if (window.uploadOptimizations.duplicate) {
              const key = window.Utils.getImageKey(originalFile);
              const isDuplicateInCategory = this.categoryData[categoryName].files.some(existingFile => 
                window.Utils.getImageKey(existingFile) === key
              );
              
              if (isDuplicateInCategory) {
                console.log(`중복 파일 건너뜀: ${originalFile.name}`);
                continue;
              }
            }
            
            try {
              // 이미지 리사이징 (필수)
              const resizedFile = await window.Utils.resizeImageForUpload(originalFile, window.uploadOptimizations.resizePixels, 0.95);
              this.categoryData[categoryName].files.push(resizedFile);
              
              // 해시 생성 (리사이징된 파일 기준)
              const key = window.Utils.getImageKey(resizedFile);
              if (!window.imageHashes.has(key)) {
                window.imageHashes.set(key, await window.Utils.generateImageHash(resizedFile));
              }
              
            } catch (fileError) {
              console.error(`파일 처리 중 오류 (${originalFile.name}):`, fileError);
              // 리사이징 실패 시 원본 파일 사용
              this.categoryData[categoryName].files.push(originalFile);
            }
          }
          
          const processed = Math.min(i + batchSize, files.length);
          
          // 진행률 표시
          uploadingIndicator.textContent = `업로드 중... (${processed}/${files.length})`;
          fileCountSpan.textContent = this.categoryData[categoryName].files.length;
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        uploadingIndicator.style.display = 'none';
        window.Utils.setButtonLoading(loadBtn, false);
        
        // 활성화된 최적화 옵션들을 확인하여 메시지 생성
        const activeOptimizations = [`${window.uploadOptimizations.resizePixels}px 리사이징`];
        if (window.uploadOptimizations.batch) activeOptimizations.push('배치처리');
        if (window.uploadOptimizations.duplicate) activeOptimizations.push('중복감지');
        if (window.uploadOptimizations.memory) activeOptimizations.push('메모리최적화');
        
        const message = `${files.length}개 파일 업로드 완료! (${activeOptimizations.join(', ')})`;
        window.Utils.showProcessingMessage(message);
        
        this.saveSettings();
        this.triggerAutoSave();
        
      } catch (error) {
        console.error('업로드 중 오류:', error);
        uploadingIndicator.style.display = 'none';
        window.Utils.setButtonLoading(loadBtn, false);
        window.Utils.showProcessingMessage('업로드 중 오류가 발생했습니다.');
      }
    });

    // 수량 조절
    wrapper.querySelector(".increase").onclick = () => {
      previewInput.value = parseInt(previewInput.value) + 1;
    };
    
    wrapper.querySelector(".decrease").onclick = () => {
      const currentValue = parseInt(previewInput.value);
      if (currentValue > 0) {
        previewInput.value = currentValue - 1;
        
        if (currentValue - 1 === 0) {
          setTimeout(() => this.toggleCategory(categoryName), 100);
        }
      }
    };

    // 미리보기 수 변경 감지
    previewInput.addEventListener('change', () => {
      const value = parseInt(previewInput.value);
      if (value === 0) {
        setTimeout(() => this.toggleCategory(categoryName), 100);
      }
    });

    // 불러오기 버튼
    loadBtn.onclick = async () => {
      if (loadBtn.disabled) {
        return;
      }

      const category = this.categories.find(cat => cat.name === categoryName);
      if (!category.enabled) {
        alert('비활성화된 카테고리입니다!');
        return;
      }

      window.Utils.setButtonLoading(loadBtn, true);
      window.Utils.showProcessingMessage('이미지를 불러오는 중...');
      
      const count = parseInt(previewInput.value);
      const files = this.categoryData[categoryName].files;
      
      if (!files || files.length === 0) {
        alert(`${categoryName} 카테고리에 업로드된 파일이 없습니다!`);
        window.Utils.setButtonLoading(loadBtn, false);
        return;
      }

      try {
        let availableFiles = [...files];

        const selected = [];
        const maxCount = Math.min(count, availableFiles.length);
        
        const shuffled = [...availableFiles].sort(() => 0.5 - Math.random());
        for (let i = 0; i < maxCount; i++) {
          selected.push(shuffled[i]);
        }

        this.categoryData[categoryName].previews = selected;
        await this.displayPreviews(categoryName, selected);
        this.updateSelectedCount();
        this.updatePreviewCountPopup();
        
        window.Utils.setButtonLoading(loadBtn, false);
        window.Utils.showProcessingMessage(`${selected.length}개 이미지가 로드되었습니다!`);
        this.triggerAutoSave();

      } catch (error) {
        console.error('불러오기 중 오류:', error);
        window.Utils.setButtonLoading(loadBtn, false);
        window.Utils.showProcessingMessage('불러오기 중 오류가 발생했습니다.');
      }
    };
  }

  // 미리보기 표시 함수
  async displayPreviews(categoryName, files) {
    const container = document.querySelector(`[data-category="${categoryName}"] .preview-container`);
    if (!container) {
      console.error(`카테고리 "${categoryName}"의 미리보기 컨테이너를 찾을 수 없습니다.`);
      return;
    }

    // 매개변수 유효성 검사
    if (!Array.isArray(files) || files.length === 0) {
      console.warn(`카테고리 "${categoryName}"에 표시할 파일이 없습니다.`);
      container.innerHTML = "";
      return;
    }
    
    // 기존 Sortable 인스턴스 제거 (미리 제거)
    if (container.sortableInstance) {
      container.sortableInstance.destroy();
      container.sortableInstance = null;
    }
    
    container.innerHTML = "";
    
    // 모든 이미지가 로드될 때까지 기다리기 위한 Promise 배열
    const imagePromises = [];
    
    for (const [idx, file] of files.entries()) {
      const imagePromise = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => {
          const div = document.createElement("div");
          div.className = "preview-item";
          div.innerHTML = `
            <img src="${e.target.result}" 
                 class="preview-img" 
                 data-category="${categoryName}" 
                 data-file-key="${window.Utils.getImageKey(file)}"
                 data-original-index="${idx}"
                 style="width:${window.thumbnailSize}px; height:${window.thumbnailSize}px; object-fit:cover;" />
            <button class="refresh-btn" title="새로고침">↻</button>
            <button class="remove-btn" title="제거">✕</button>
          `;
          container.appendChild(div);

          div.querySelector(".refresh-btn").onclick = () => this.refreshImage(categoryName, file, div);
          div.querySelector(".remove-btn").onclick = () => this.removeImage(categoryName, file, div);
          
          resolve();
        };
        reader.readAsDataURL(file);
      });
      imagePromises.push(imagePromise);
    }
    
    // 모든 이미지 로드 완료 후 Sortable 초기화
    await Promise.all(imagePromises);
    
    const addDiv = document.createElement("div");
    addDiv.className = "add-item";
    addDiv.textContent = "+";
    addDiv.style.width = window.thumbnailSize + 'px';
    addDiv.style.height = window.thumbnailSize + 'px';
    addDiv.onclick = () => this.addMoreImages(categoryName);
    container.appendChild(addDiv);
    
    // add-item이 항상 맨 뒤에 위치하도록 보장
    addDiv.parentNode.appendChild(addDiv);
    
    // DOM이 완전히 준비된 후 Sortable 초기화
    setTimeout(() => {
      // 컨테이너가 아직 존재하는지 확인
      if (!container || !container.parentNode) {
        console.warn(`카테고리 "${categoryName}"의 컨테이너가 더 이상 존재하지 않습니다.`);
        return;
      }
      
      // 기존 인스턴스가 있다면 정리
      if (this.sortableInstances.has(categoryName)) {
        const oldInstance = this.sortableInstances.get(categoryName);
        if (oldInstance && oldInstance.destroy && typeof oldInstance.destroy === 'function') {
          try {
            // 인스턴스가 아직 유효한지 확인
            if (oldInstance.el && oldInstance.el.parentNode) {
              oldInstance.destroy();
            }
          } catch (destroyError) {
            console.warn('Sortable 인스턴스 정리 중 오류:', destroyError);
          }
        }
        this.sortableInstances.delete(categoryName);
      }

      // 컨테이너에 기존 sortableInstance가 있다면 정리
      if (container.sortableInstance) {
        try {
          if (container.sortableInstance.el && container.sortableInstance.el.parentNode) {
            container.sortableInstance.destroy();
          }
        } catch (destroyError) {
          console.warn('컨테이너 Sortable 인스턴스 정리 중 오류:', destroyError);
        }
        container.sortableInstance = null;
      }

      try {
        // 새로운 Sortable 인스턴스 생성 (이미지 로드 완료 후)
        const sortableInstance = new Sortable(container, {
          animation: 150,
          ghostClass: 'drag-placeholder',
          filter: '.add-item',
          preventOnFilter: false, // add-item도 드래그는 허용하되 정렬에서만 제외
          onStart: (evt) => {
            // add-item이 드래그되는 경우 표시
            if (evt.item.classList.contains('add-item')) {
              evt.item.setAttribute('data-is-add-item', 'true');
            }
          },
          onSort: (evt) => {
            console.log('Sortable onSort 이벤트:', evt.oldIndex, '->', evt.newIndex);
            console.log('현재 배열 상태:', this.categoryData[categoryName].previews.length);
            
            // add-item이 드래그된 경우 원래 위치로 되돌리고 무시
            if (evt.item.classList.contains('add-item') || evt.item.getAttribute('data-is-add-item') === 'true') {
              console.log('add-item 드래그 감지, 무시하고 원래 위치로 복원');
              evt.item.removeAttribute('data-is-add-item');
              // add-item을 맨 뒤로 이동
              container.appendChild(evt.item);
              return;
            }
            
            // 실제로 위치가 바뀌었는지 확인
            if (evt.oldIndex === evt.newIndex) {
              console.log('위치 변경 없음');
              return;
            }
            
            // add-item 개수 고려하여 인덱스 보정
            const addItemCount = container.querySelectorAll('.add-item').length;
            const maxValidIndex = this.categoryData[categoryName].previews.length;
            
            // 인덱스 유효성 확인 (add-item 제외)
            if (evt.oldIndex >= maxValidIndex || evt.newIndex >= maxValidIndex) {
              console.log('인덱스 범위 초과:', evt.oldIndex, evt.newIndex, maxValidIndex);
              // 잘못된 위치로 이동한 경우 원래 순서로 복원
              this.displayPreviews(categoryName, this.categoryData[categoryName].previews);
              return;
            }
            
            // 배열에서 직접 순서 변경
            console.log('배열 순서 변경 전:', this.categoryData[categoryName].previews.length);
            const movedItem = this.categoryData[categoryName].previews.splice(evt.oldIndex, 1)[0];
            this.categoryData[categoryName].previews.splice(evt.newIndex, 0, movedItem);
            console.log('배열 순서 변경 후:', this.categoryData[categoryName].previews.length);
            
            this.triggerAutoSave();
          }
        });
        
        // 인스턴스 추적에 추가
        container.sortableInstance = sortableInstance;
        this.sortableInstances.set(categoryName, sortableInstance);
        
        // add-item 위치 보정
        this.ensureAddItemPosition(categoryName);
        
        console.log('Sortable 초기화 완료:', categoryName, this.categoryData[categoryName].previews.length);
      } catch (sortableError) {
        console.error('Sortable 초기화 중 오류:', sortableError);
        console.error('카테고리:', categoryName, '컨테이너:', container);
      }
    }, 100);
  }

  // add-item 위치 보정 (미리보기 로드 후 호출)
  ensureAddItemPosition(categoryName) {
    const container = document.querySelector(`[data-category="${categoryName}"] .preview-container`);
    if (!container) return;
    
    const addItem = container.querySelector('.add-item');
    if (!addItem) return;
    
    // add-item이 맨 마지막에 있지 않으면 이동
    const allItems = container.children;
    if (allItems.length > 0 && allItems[allItems.length - 1] !== addItem) {
      container.appendChild(addItem);
      console.log(`add-item 위치 보정: ${categoryName}`);
    }
  }

  // + 버튼 클릭 시 이미지 추가
  async addMoreImages(categoryName) {
    const category = this.categories.find(cat => cat.name === categoryName);
    if (!category.enabled) {
      alert('비활성화된 카테고리입니다!');
      return;
    }

    const files = this.categoryData[categoryName].files;
    if (!files || files.length === 0) {
      alert(`${categoryName} 카테고리에 업로드된 파일이 없습니다!`);
      return;
    }

    let availableFiles = files.filter(file => !this.categoryData[categoryName].previews.includes(file));
    if (availableFiles.length === 0) {
      alert('추가할 수 있는 이미지가 없습니다!');
      return;
    }

    const selectedFile = availableFiles[Math.floor(Math.random() * availableFiles.length)];
    
    this.categoryData[categoryName].previews.push(selectedFile);
    
    const wrapper = document.querySelector(`[data-category="${categoryName}"]`);
    const previewInput = wrapper.querySelector("input[type=number]");
    previewInput.value = this.categoryData[categoryName].previews.length;
    
    await this.displayPreviews(categoryName, this.categoryData[categoryName].previews);
    this.ensureAddItemPosition(categoryName); // add-item 위치 보정
    this.updateSelectedCount();
    this.updatePreviewCountPopup();
    this.triggerAutoSave();
    window.Utils.showProcessingMessage('이미지가 추가되었습니다!');
  }

  // 이미지 제거
  removeImage(categoryName, file, div) {
    
    const index = this.categoryData[categoryName].previews.indexOf(file);
    if (index !== -1) {
      this.categoryData[categoryName].previews.splice(index, 1);
    }
    
    div.remove();
    
    const wrapper = document.querySelector(`[data-category="${categoryName}"]`);
    const previewInput = wrapper.querySelector("input[type=number]");
    previewInput.value = this.categoryData[categoryName].previews.length;
    
    // add-item 위치 보정
    this.ensureAddItemPosition(categoryName);
    
    if (this.categoryData[categoryName].previews.length === 0) {
      setTimeout(() => this.toggleCategory(categoryName), 100);
    }
    
    this.updateSelectedCount();
    this.updatePreviewCountPopup();
    this.triggerAutoSave();
    window.Utils.showProcessingMessage('이미지가 제거되었습니다!');
  }

  // 이미지 새로고침
  async refreshImage(categoryName, currentFile, div) {
    const allFiles = this.categoryData[categoryName].files;
    
    const otherFiles = allFiles.filter(f => f !== currentFile);
    if (otherFiles.length === 0) {
      alert("교체할 수 있는 다른 이미지가 없습니다!");
      return;
    }
    
    const newFile = otherFiles[Math.floor(Math.random() * otherFiles.length)];
    
    const fileIndex = this.categoryData[categoryName].previews.indexOf(currentFile);
    if (fileIndex !== -1) {
      this.categoryData[categoryName].previews[fileIndex] = newFile;
    }
    
    const reader = new FileReader();
    reader.onload = e => {
      const img = div.querySelector("img");
      img.src = e.target.result;
    };
    reader.readAsDataURL(newFile);
    
    div.querySelector(".refresh-btn").onclick = () => this.refreshImage(categoryName, newFile, div);
    div.querySelector(".remove-btn").onclick = () => this.removeImage(categoryName, newFile, div);
    
    this.updateSelectedCount();
    this.triggerAutoSave();
    window.Utils.showProcessingMessage('이미지가 교체되었습니다!');
  }

  // 자동저장 트리거 (중요한 변경사항만)
  triggerAutoSave() {
    // 자동저장은 시간 기반으로만 동작하도록 변경
    // 개별 액션에서는 자동저장을 트리거하지 않음
    console.log('자동저장 트리거 요청 무시됨 (시간 기반 자동저장만 활성)');
  }

  // 메모리 정리 메서드
  cleanup() {
    try {
      // Sortable 인스턴스들 정리
      this.sortableInstances.forEach((instance, key) => {
        if (instance && instance.destroy) {
          try {
            instance.destroy();
          } catch (destroyError) {
            console.warn(`Sortable 인스턴스 "${key}" 정리 중 오류:`, destroyError);
          }
        }
      });
      this.sortableInstances.clear();

      // 컨테이너의 sortableInstance 정리
      document.querySelectorAll('.preview-container').forEach(container => {
        if (container.sortableInstance) {
          try {
            container.sortableInstance.destroy();
          } catch (destroyError) {
            console.warn('컨테이너 Sortable 인스턴스 정리 중 오류:', destroyError);
          }
          container.sortableInstance = null;
        }
      });

      // 카테고리 데이터 정리
      Object.keys(this.categoryData).forEach(categoryName => {
        if (this.categoryData[categoryName] && this.categoryData[categoryName].previews) {
          this.categoryData[categoryName].previews.length = 0; // 배열 비우기
        }
        if (this.categoryData[categoryName] && this.categoryData[categoryName].files) {
          this.categoryData[categoryName].files.length = 0; // 배열 비우기
        }
      });

      console.log('CategoryManager 메모리 정리 완료');
    } catch (error) {
      console.error('CategoryManager 정리 중 오류:', error);
    }
  }
}

// CategoryManager를 전역 객체로 등록
window.CategoryManager = CategoryManager; 