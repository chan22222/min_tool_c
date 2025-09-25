/**
 * 네이버 블로그 순위 체크 도구
 * Version: 12.3.5
 * Last Updated: 2025.09.21
 * 
 * 주요 기능:
 * - 모든 블로그 플랫폼 집계 (네이버, 티스토리, 다음, 인플루언서 등)
 * - 인플루언서 탭 정확한 집계
 * - 정확한 순위 표시 (모든 VIEW 탭 결과 포함)
 * - PostID 정확 비교로 같은 블로그의 다른 게시물 구분
 * - 20위까지 확장된 순위 검색
 * - 프록시 서버를 통한 안정적인 검색
 */

class BlogRankChecker {
  constructor() {
    this.searchCache = new Map(); // 검색 결과 캐싱
    this.isSearching = false; // 검색 중 상태 관리
    this.searchAbortController = null; // 검색 취소용 컨트롤러
    this.isWaitingForAutoSelect = false; // 4초 대기 상태 플래그
    this.currentPopup = null; // 현재 열린 팝업 참조
    this.currentViewMode = 'individual'; // 'individual' 또는 'summary'
    this.extensionId = null; // Chrome Extension ID
    this.extensionAvailable = false; // 확장 프로그램 사용 가능 여부
        this.availableServers = [
       { 
        name: 'CorsProxy.io', 
        url: 'https://corsproxy.io/?', 
        speed: 'fast', 
        reliability: 'high',
        description: '안정적인 CORS 프록시'
      },
      {
        name: 'Cloudflare CORS',
        url: 'https://test.cors.workers.dev/?',
        speed: 'fast',
        reliability: 'high',
        description: 'Cloudflare Workers 기반'
      },
      {
        name: 'CORS.SH Proxy',
        url: 'https://proxy.cors.sh/',
        speed: 'fast',
        reliability: 'high',
        description: '빠른 응답 속도'
      },
      {
        name: 'CodeTabs Proxy',
        url: 'https://api.codetabs.com/v1/proxy?quest=',
        speed: 'medium',
        reliability: 'medium',
        description: 'CodeTabs CORS 프록시'
      },
      {
        name: 'CORS Buster',
        url: 'https://cors-buster.now.sh/?href=',
        speed: 'medium',
        reliability: 'medium',
        description: 'CORS Buster'
      },
      {
        name: 'HTMLDriven CORS',
        url: 'https://cors-proxy.htmldriven.com/?url=',
        speed: 'medium',
        reliability: 'medium',
        description: 'AJAX 요청용 간단한 프록시'
      },
      {
        name: 'Go Between OKLabs',
        url: 'https://gobetween.oklabs.org/',
        speed: 'medium',
        reliability: 'low',
        description: '도메인 매핑 지원 (2017년 마지막 업데이트)'
      },
      { 
        name: 'AllOrigins', 
        url: 'https://api.allorigins.win/raw?url=', 
        speed: 'fast', 
        reliability: 'medium',
        description: '고속 (간헐적 제한)'
      }



    ];
    this.serverStatus = new Map(); // 서버별 상태 저장
    this.selectedServers = new Set(); // 선택된 서버들
    this.lastProgress = 0; // 진행률 안정화용
    this.init();
  }

  init() {
    document.getElementById('checkRankBtn').addEventListener('click', () => {
      if (this.isSearching) {
        this.cancelSearch();
      } else {
        this.checkRanks();
      }
    });
    document.getElementById('refreshServers').addEventListener('click', () => this.checkAllServers(true)); // 버튼 클릭 시에는 자동 선택
    document.getElementById('launchServers').addEventListener('click', () => this.launchSelfServers());
    document.getElementById('downloadProxyZip').addEventListener('click', () => this.downloadProxyServerZip());
    
    // 키워드 입력 필드에서 포커스가 벗어날 때 중복 체크
    document.getElementById('keywords').addEventListener('blur', () => this.checkKeywordDuplicates());
    
    // 블로그 URL 입력 필드에서 포커스가 벗어날 때 중복 체크
    document.getElementById('blogUrls').addEventListener('blur', () => this.checkBlogUrlDuplicates());
    
    this.initServerList();
    this.checkAllServers(true); // 초기 로딩시에도 4초 대기 후 자동 선택
  }

  // 프로그래스 업데이트 (실시간 정보)
  updateProgress(current, total, message = '', proxyInfo = '') {
    const percentage = Math.round((current / total) * 100);
    const progressBar = document.getElementById('progressBar');
    const progressInfo = document.getElementById('progressInfo');
    
    // 진행률 안정화: 이전 진행률보다 낮아지지 않도록 보정
    if (this.lastProgress && percentage < this.lastProgress && current < total) {
      return; // 진행률이 감소하는 경우 업데이트 건너뛰기
    }
    this.lastProgress = percentage;
    
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
      progressBar.textContent = `${percentage}%`;
    }
    
    if (progressInfo && message) {
      // 현재 시간 실시간 표시
      const currentTime = new Date().toLocaleTimeString('ko-KR');
      let timeInfo = '';
      
      // 경과 시간 표시
      if (this.startTime) {
        const elapsed = Date.now() - this.startTime;
        const elapsedMin = Math.floor(elapsed / 60000);
        const elapsedSec = Math.floor((elapsed % 60000) / 1000);
        timeInfo += `경과시간: ${elapsedMin}분 ${elapsedSec}초`;
      }
      
      // 예상 시간 계산 (개선된 로직)
      if (current > 0 && this.startTime) {
        const elapsed = Date.now() - this.startTime;
        const remaining = total - current;
        
        if (remaining > 0) {
          // 최소 3개 항목이 완료된 후에만 예상시간 표시 (더 정확한 예측을 위해)
          if (current >= 3) {
            const avgTimePerItem = elapsed / current;
            // 보수적 계산: 1.2배 여유를 둠 (실제보다 약간 길게 예상)
            const estimatedMs = remaining * avgTimePerItem * 1.2;
            const estimatedMin = Math.floor(estimatedMs / 60000);
            const estimatedSec = Math.floor((estimatedMs % 60000) / 1000);
            timeInfo += ` / 남은 예상시간: ${estimatedMin}분 ${estimatedSec}초`;
        } else {
            timeInfo += ` / 남은 예상시간: 계산 중...`;
          }
        } else if (remaining === 0) {
          timeInfo += ` / 완료!`;
        }
      }
      
      // 프록시 정보 추가 (실시간)
      if (proxyInfo) {
        timeInfo += `\n🔗 ${proxyInfo}`;
      }
      
      // 진행 상황 (현재 시간 포함)
      timeInfo += `\n📊 ${message} (${current}/${total}) - ${currentTime}`;
      
      progressInfo.textContent = timeInfo;
    }
    
    // 진행 상황을 저장하여 다른 곳에서도 참조 가능
    this.currentProgress = { current, total, message, proxyInfo };
  }

  // 실시간 프록시 상태 업데이트 전용 함수
  updateProxyStatus(proxyInfo) {
    const progressInfo = document.getElementById('progressInfo');
    if (progressInfo && this.currentProgress) {
      const currentTime = new Date().toLocaleTimeString('ko-KR');
      let timeInfo = '';
      
      // 경과 시간
      if (this.startTime) {
        const elapsed = Date.now() - this.startTime;
        const elapsedMin = Math.floor(elapsed / 60000);
        const elapsedSec = Math.floor((elapsed % 60000) / 1000);
        timeInfo += `경과시간: ${elapsedMin}분 ${elapsedSec}초`;
      }
      
      // 예상 시간 (개선된 로직)
      const { current, total } = this.currentProgress;
      if (current > 0 && this.startTime) {
        const elapsed = Date.now() - this.startTime;
        const remaining = total - current;
        
        if (remaining > 0) {
          if (current >= 3) {
            const avgTimePerItem = elapsed / current;
            const estimatedMs = remaining * avgTimePerItem * 1.2;
            const estimatedMin = Math.floor(estimatedMs / 60000);
            const estimatedSec = Math.floor((estimatedMs % 60000) / 1000);
            timeInfo += ` / 남은 예상시간: ${estimatedMin}분 ${estimatedSec}초`;
          } else {
            timeInfo += ` / 남은 예상시간: 계산 중...`;
          }
        }
      }
      
      // 새로운 프록시 정보
      timeInfo += `\n🔗 ${proxyInfo}`;
      
      // 진행 상황
      timeInfo += `\n📊 ${this.currentProgress.message} (${current}/${total}) - ${currentTime}`;
      
      progressInfo.textContent = timeInfo;
    }
  }

  showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    
    // 시간 없이 단순 메시지
    const loadingText = document.getElementById('loadingText');
    if (loadingText) {
      loadingText.textContent = '순위를 확인하는 중입니다...';
    }
  }

  hideLoading() {
    document.getElementById('loading').style.display = 'none';
  }

  // 검색 버튼 상태 관리
  setSearchButtonState(isSearching) {
    const btn = document.getElementById('checkRankBtn');
    
    if (isSearching) {
      btn.textContent = '❌ 검색 취소';
      btn.className = 'check-btn cancel-btn';
      btn.style.background = 'linear-gradient(45deg, #dc3545, #c82333)';
      this.isSearching = true;
    } else {
      btn.textContent = '🔍 순위 검색 시작';
      btn.className = 'check-btn';
      btn.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
      this.isSearching = false;
    }
  }

  // 검색 취소 처리
  cancelSearch() {
    if (this.searchAbortController) {
      this.searchAbortController.abort();
      console.log('🚫 사용자가 검색을 취소했습니다');
      
      // UI 상태 복원
      this.hideLoading();
      this.setSearchButtonState(false);
      
      // 결과 영역에 취소 메시지 표시
      const resultsDiv = document.getElementById('resultsList');
      resultsDiv.innerHTML = `
        <div class="cancel-message" style="text-align: center; padding: 40px; background: #fff3cd; border-radius: 10px; border: 1px solid #ffeaa7;">
          <h3 style="color: #856404; margin-bottom: 10px;">🚫 검색이 취소되었습니다</h3>
          <p style="color: #856404;">사용자 요청에 의해 검색이 중단되었습니다.</p>
        </div>
      `;
      document.getElementById('results').style.display = 'block';
    }
  }

  // 서버 목록 UI 초기화
  initServerList() {
    const serverListDiv = document.getElementById('serverList');
    serverListDiv.innerHTML = '';
    
    this.availableServers.forEach((server, index) => {
      // 비활성화된 서버는 숨김 처리
      if (server.enabled === false) return;
      
      const serverItem = document.createElement('div');
      serverItem.className = `server-item ${server.speed}`;
      serverItem.innerHTML = `
        <input type="checkbox" id="server-${index}" class="server-checkbox" data-server-index="${index}">
        <div class="server-status checking" id="status-${index}"></div>
        <div class="server-info">
          <div class="server-name">${server.name}</div>
          <div class="server-url">${server.url}</div>
          <div class="server-details">${server.description}</div>
        </div>
      `;
      
      // 체크박스 이벤트 리스너
      const checkbox = serverItem.querySelector('.server-checkbox');
      checkbox.addEventListener('change', (e) => {
        if (this.isWaitingForAutoSelect) {
          e.preventDefault(); // 이벤트 자체를 차단
          checkbox.checked = !checkbox.checked; // 변경 취소
          return false;
        }
        this.toggleServer(index, checkbox.checked);
      });
      
      // 전체 서버 아이템 클릭으로도 체크박스 토글
      serverItem.addEventListener('click', (e) => {
        // 체크박스 자체 클릭은 중복 처리 방지
        if (e.target === checkbox) return;
        
        // 4초 대기 중이면 클릭 무시
        if (this.isWaitingForAutoSelect) return;
        
        checkbox.checked = !checkbox.checked;
        this.toggleServer(index, checkbox.checked);
      });
      
      // 마우스 커서 포인터로 변경
      serverItem.style.cursor = 'pointer';
      
      serverListDiv.appendChild(serverItem);
    });
    
    this.updateSelectedServerCount();
  }

  // 서버 선택/해제
  toggleServer(serverIndex, isSelected, skipExclusiveLogic = false) {
    const server = this.availableServers[serverIndex];
    const checkbox = document.getElementById(`server-${serverIndex}`);
    if (!checkbox) return; // DOM 요소가 없으면 리턴
    
    const serverItem = checkbox.closest('.server-item');
    const statusElement = document.getElementById(`status-${serverIndex}`);
    
    // 비활성화된 서버는 선택할 수 없음
    if (isSelected && statusElement && statusElement.classList.contains('offline')) {
      checkbox.checked = false;
      alert('비활성화된 서버는 선택할 수 없습니다.');
      return;
    }
    
    if (isSelected) {
      // 배타적 선택 로직 (자동 선택이 아닐 때만 적용)
      if (!skipExclusiveLogic) {
        // 자체 서버(localhost) 선택 시 다른 서버들 자동 해제
        if (server.url.includes('localhost')) {
        // 다른 모든 서버 해제
        this.availableServers.forEach((otherServer, otherIndex) => {
          if (otherIndex !== serverIndex && !otherServer.url.includes('localhost')) {
            const otherCheckbox = document.getElementById(`server-${otherIndex}`);
            if (!otherCheckbox) return;
            
            const otherServerItem = otherCheckbox.closest('.server-item');
            if (otherCheckbox.checked) {
              otherCheckbox.checked = false;
              this.selectedServers.delete(otherServer.url);
              otherServerItem.classList.remove('checked');
            }
          }
        });
      }
      // 외부 서버 선택 시 자체 서버들 자동 해제
      else {
        this.availableServers.forEach((otherServer, otherIndex) => {
          if (otherIndex !== serverIndex && otherServer.url.includes('localhost')) {
            const otherCheckbox = document.getElementById(`server-${otherIndex}`);
            if (!otherCheckbox) return;
            
            const otherServerItem = otherCheckbox.closest('.server-item');
            if (otherCheckbox.checked) {
              otherCheckbox.checked = false;
              this.selectedServers.delete(otherServer.url);
              otherServerItem.classList.remove('checked');
            }
          }
        });
        }
      }
      
      this.selectedServers.add(server.url);
      serverItem.classList.add('checked');
    } else {
      this.selectedServers.delete(server.url);
      serverItem.classList.remove('checked');
    }
    
    this.updateSelectedServerCount();
    this.updateNodeBunColors();
  }

  // Node.js와 Bun 서버 색상 업데이트
  updateNodeBunColors() {
    this.availableServers.forEach((server, index) => {
      if (server.url.includes('localhost')) {
        const serverItem = document.querySelector(`#server-${index}`).closest('.server-item');
        const checkbox = document.getElementById(`server-${index}`);
        
        if (checkbox && serverItem) {
          // 체크되어 있으면 원래 색상, 체크 안되어 있으면 기본 색상
          if (checkbox.checked) {
            // 체크된 상태: 원래 속도별 색상 유지
            serverItem.className = `server-item ${server.speed} checked`;
          } else {
            // 체크 안된 상태: 기본 색상으로 변경 (fast와 같은 색상)
            serverItem.className = `server-item fast`;
          }
        }
      }
    });
  }

  // 선택된 서버 수 업데이트
  updateSelectedServerCount() {
    const countElement = document.getElementById('selectedServerCount');
    countElement.textContent = `선택된 서버: ${this.selectedServers.size}개`;
  }

  // 단일 서버 상태 체크
  async checkServerStatus(server, index) {
    const statusElement = document.getElementById(`status-${index}`);
    const checkbox = document.getElementById(`server-${index}`);
    if (!checkbox) return false; // DOM 요소가 없으면 실패 반환
    
    const serverItem = checkbox.closest('.server-item');
    
    statusElement.className = 'server-status checking';
    
    try {
      const testUrl = 'https://httpbin.org/status/200';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(server.url + encodeURIComponent(testUrl), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal,
        mode: 'cors'
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        statusElement.className = 'server-status online';
        this.serverStatus.set(server.url, 'online');
        serverItem.classList.remove('disabled');
        checkbox.disabled = false;
        
        // 첫 번째로 작동하는 서버는 자동으로 선택
        if (this.selectedServers.size === 0) {
          checkbox.checked = true;
          this.toggleServer(index, true);
        }
        
        return true;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      statusElement.className = 'server-status offline';
      this.serverStatus.set(server.url, 'offline');
      serverItem.classList.add('disabled');
      checkbox.disabled = true;
      checkbox.checked = false;
      this.selectedServers.delete(server.url);
      this.updateSelectedServerCount();
      
      // 에러를 조용히 처리 (콘솔 로그 제거)
      // console.log(`❌ ${server.name}: ${error.message}`);
      return false;
    }
  }

  // 모든 서버 상태 체크
  async checkAllServers(enableAutoSelect = false) {
    console.log('🔄 서버 상태 체크 시작...');
    const refreshBtn = document.getElementById('refreshServers');
    refreshBtn.disabled = true;
    refreshBtn.textContent = '🔄 확인 중...';
    
    // 자동 선택이 활성화된 경우 즉시 4초 대기 시작
    if (enableAutoSelect) {
      console.log('⏳ 4초 대기 후 자동 서버 선택...');
      refreshBtn.textContent = '⏳ 잠시만 기다려주세요...';
      
      // 4초 대기 상태 즉시 활성화
      this.isWaitingForAutoSelect = true;
      
      // 모든 서버 체크박스와 아이템 즉시 비활성화 (비활성화된 서버 제외)
      this.availableServers.forEach((server, index) => {
        if (server.enabled === false) return;
        
        const checkbox = document.getElementById(`server-${index}`);
        if (!checkbox) return;
        
        const serverItem = checkbox.closest('.server-item');
        if (checkbox && serverItem) {
          checkbox.disabled = true;
          serverItem.style.opacity = '0.5';
          serverItem.style.pointerEvents = 'none';
        }
      });
    }
    
    // 모든 서버를 병렬로 체크 (비활성화된 서버 제외)
    const checkPromises = this.availableServers.map((server, index) => {
      if (server.enabled === false) return Promise.resolve(false);
      return this.checkServerStatus(server, index);
    });
    
    const results = await Promise.all(checkPromises);
    const onlineCount = results.filter(result => result).length;
    
    refreshBtn.disabled = false;
    refreshBtn.textContent = '🔄 서버 상태 새로고침';
    
    console.log(`✅ 서버 체크 완료: ${onlineCount}/${this.availableServers.length}개 온라인`);
    
    // 자동 서버 선택 로직 (enableAutoSelect가 true일 때만)
    if (enableAutoSelect) {
      // 4초 타이머가 이미 시작되었으므로, 서버 체크 완료 후 4초 타이머 시작
      setTimeout(() => {
        refreshBtn.textContent = '🔄 서버 상태 새로고침';
        
        // 4초 대기 상태 해제
        this.isWaitingForAutoSelect = false;
        
        // 모든 서버 체크박스와 아이템 다시 활성화
        this.availableServers.forEach((server, index) => {
          const checkbox = document.getElementById(`server-${index}`);
          if (!checkbox) return;
          
          const serverItem = checkbox.closest('.server-item');
          if (checkbox && serverItem) {
            checkbox.disabled = false;
            serverItem.style.opacity = '1';
            serverItem.style.pointerEvents = 'auto';
          }
        });
        
        this.autoSelectServers(true);
      }, 4000);
    } else {
      // enableAutoSelect가 false일 때는 체크박스를 즉시 활성화
      this.availableServers.forEach((server, index) => {
        const checkbox = document.getElementById(`server-${index}`);
        if (checkbox) checkbox.disabled = false;
      });
    }
    
    // 자체 서버 켜기 버튼 표시/숨김
    this.updateLaunchButton();
  }

  // 자동 서버 선택 로직
  autoSelectServers(forceUpdate = false) {
    // 강제 업데이트가 아니고 이미 선택된 서버가 있으면 그대로 유지
    if (!forceUpdate && this.selectedServers.size > 0) {
      return;
    }

    // 강제 업데이트인 경우 기존 선택 해제
    if (forceUpdate) {
      this.selectedServers.clear();
      this.availableServers.forEach((server, index) => {
        const checkbox = document.getElementById(`server-${index}`);
        const serverItem = checkbox?.closest('.server-item');
        if (checkbox) {
          checkbox.checked = false;
          serverItem?.classList.remove('checked');
        }
      });
    }

    // 1. 자체 프록시 서버 우선 선택 (Node.js와 Bun)
    const selfProxyIndices = [];
    this.availableServers.forEach((server, index) => {
      if (server.url.includes('localhost')) {
        const status = this.serverStatus.get(server.url);
        if (status === 'online') {
          selfProxyIndices.push(index);
        }
      }
    });

    if (selfProxyIndices.length > 0) {
      // 자체 서버가 있으면 모두 선택 (배타적 선택 로직 우회)
      selfProxyIndices.forEach(index => {
        const checkbox = document.getElementById(`server-${index}`);
        if (checkbox) {
          checkbox.checked = true;
          this.toggleServer(index, true, true); // skipExclusiveLogic = true
        }
      });
      console.log(`🏠 자체 프록시 서버 ${selfProxyIndices.length}개 자동 선택됨`);
      return;
    }

    // 2. 자체 서버가 없으면 온라인 서버 중 가장 빠른 것들 선택
    const onlineServers = [];
    this.availableServers.forEach((server, index) => {
      const status = this.serverStatus.get(server.url);
      if (status === 'online' && server.enabled !== false) {
        onlineServers.push({ index, server });
      }
    });

    if (onlineServers.length > 0) {
      // 속도 우선순위: ultra-fast-plus > ultra-fast > fast > medium
      const speedPriority = { 'ultra-fast-plus': 4, 'ultra-fast': 3, 'fast': 2, 'medium': 1 };
      onlineServers.sort((a, b) => (speedPriority[b.server.speed] || 0) - (speedPriority[a.server.speed] || 0));
      
      // 상위 2개 서버 자동 선택
      const serversToSelect = onlineServers.slice(0, 2);
      serversToSelect.forEach(({ index }) => {
        const checkbox = document.getElementById(`server-${index}`);
        if (checkbox) {
          checkbox.checked = true;
          this.toggleServer(index, true, true); // skipExclusiveLogic = true
        }
      });
      console.log(`🌐 외부 프록시 서버 ${serversToSelect.length}개 자동 선택됨`);
    } else {
      console.warn('⚠️ 사용 가능한 서버가 없습니다');
    }
  }

  // 자체 서버 켜기 버튼 업데이트
  updateLaunchButton() {
    const launchBtn = document.getElementById('launchServers');
    const selfServersOffline = this.availableServers.some((server, index) => {
      if (server.url.includes('localhost')) {
        const status = this.serverStatus.get(server.url);
        return status !== 'online';
      }
      return false;
    });

    if (selfServersOffline) {
      launchBtn.style.display = 'inline-block';
    } else {
      launchBtn.style.display = 'none';
    }
  }

  // ZIP 파일 다운로드 함수
  async downloadProxyServerZip() {
    try {
      // 호스팅된 ZIP 파일 직접 다운로드
      const a = document.createElement('a');
      a.href = 'proxy-server-example.zip';
      a.download = 'proxy-server-example.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      console.log('✅ proxy-server-example.zip 다운로드 시작');
    } catch (error) {
      console.error('❌ ZIP 다운로드 에러:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  }

  // 확장 프로그램 ZIP 다운로드 함수
  async downloadExtensionZip() {
    try {
      // 호스팅된 ZIP 파일 직접 다운로드
      const a = document.createElement('a');
      a.href = 'modal-screenshot-extension.zip';
      a.download = 'modal-screenshot-extension.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      console.log('✅ modal-screenshot-extension.zip 다운로드 시작');
    } catch (error) {
      console.error('❌ ZIP 다운로드 에러:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  }

  // 자체 서버 켜기 기능
  launchSelfServers() {
    }
  launchSelfServers() {
    const launchBtn = document.getElementById('launchServers');
    launchBtn.disabled = true;
    launchBtn.textContent = '🚀 서버 시작 중...';

    try {
      // 배치파일 실행을 위한 안내 메시지
      const message = `
🚀 자체 프록시 서버를 시작합니다!

다음 단계를 따라하세요:
1. "proxy-server-example" 폴더로 이동
2. "프록시실행기.bat" 파일을 실행
3. 메뉴에서 원하는 옵션 선택:
   - 1번: Node.js 서버 (포트 3001)
   - 2번: Bun 서버 (포트 3002)  
   - 3번: 둘 다 병렬 실행 (권장)

서버 시작 후 "서버 상태 새로고침" 버튼을 클릭하세요.
      `;

      alert(message);

      // 폴더 열기 시도 (Windows 환경)
      if (navigator.platform.includes('Win')) {
        // Windows의 경우 파일 탐색기에서 proxy-server-example 폴더를 열려고 시도
        const folderPath = './proxy-server-example';
        console.log('📁 프록시 서버 폴더 열기 시도:', folderPath);
        
        // 실제로는 브라우저 보안상 폴더를 직접 열 수 없으므로,
        // 사용자에게 수동으로 폴더를 열도록 안내
        setTimeout(() => {
          const followUpMessage = `
📁 "proxy-server-example" 폴더를 수동으로 열어주세요.

현재 위치에서 proxy-server-example 폴더를 찾아
"프록시실행기.bat" 파일을 더블클릭하세요.

파일이 보이지 않으면:
1. 파일 탐색기에서 "보기" → "파일 확장명" 체크
2. .bat 파일이 표시되는지 확인
          `;
          if (confirm(followUpMessage + '\n\n확인을 누르면 서버 상태를 다시 체크합니다.')) {
            this.checkAllServers();
          }
        }, 2000);
      }

    } catch (error) {
      console.error('❌ 서버 시작 에러:', error);
      alert('서버 시작에 문제가 발생했습니다. 수동으로 프록시실행기.bat 파일을 실행해주세요.');
    } finally {
      launchBtn.disabled = false;
      launchBtn.textContent = '🚀 자체 서버 켜기';
    }
  }

  validateInputs() {
    const keywords = document.getElementById('keywords').value.trim();
    const blogUrls = document.getElementById('blogUrls').value.trim();

    if (!keywords) throw new Error('키워드를 입력해주세요.');
    if (!blogUrls) throw new Error('블로그 주소를 입력해주세요.');

    const keywordArray = keywords.split('\n').map(k => k.trim()).filter(k => k);
    const blogUrlArray = blogUrls.split('\n').map(u => u.trim()).filter(u => u);

    // 키워드 검증 (완화된 조건)
    const invalidKeywords = [];
    keywordArray.forEach((keyword, index) => {
      // 공백만 있거나 빈 키워드 검증
      if (/^\s*$/.test(keyword) || keyword.length === 0) {
        invalidKeywords.push(`${index + 1}번째: 빈 키워드`);
      }
      // 너무 긴 키워드 검증 (100글자 제한)
      else if (keyword.length > 100) {
        invalidKeywords.push(`${index + 1}번째: 너무 긴 키워드 (${keyword.length}글자)`);
      }
      // 의미있는 문자가 하나도 없는 경우만 차단 (특수문자만)
      else if (/^[^\w가-힣]*$/.test(keyword)) {
        invalidKeywords.push(`${index + 1}번째: "${keyword}" (의미있는 문자가 없음)`);
      }
    });

    if (invalidKeywords.length > 0) {
      alert(`⚠️ 키워드 안에 불필요한 정보가 들어있습니다.\n\n문제가 있는 키워드:\n${invalidKeywords.join('\n')}\n\n키워드는 특수문자나 공백만으로 구성될 수 없으며, 100글자를 초과할 수 없습니다.`);
      throw new Error('키워드 검증 실패');
    }

    // 블로그 URL 검증
    const invalidBlogs = [];
    blogUrlArray.forEach((url, index) => {
      // 네이버 블로그 형식 검증 (일반, 모바일, PostView, 인플루언서 모두 허용)
      const isValidNaver = (
        (url.includes('blog.naver.com') && (
          url.match(/(?:m\.)?blog\.naver\.com\/[^\/]+/) ||  // 일반/모바일 형태
          url.match(/blog\.naver\.com\/PostView\.naver/)     // PostView 형태
        )) ||
        url.includes('in.naver.com')  // 인플루언서 블로그 (더 넓게 허용)
      );
      
      if (!isValidNaver) {
        invalidBlogs.push(`${index + 1}번째: "${url}" (올바른 형식: blog.naver.com/아이디, PostView 형태, 또는 인플루언서 블로그)`);
      }
      // URL 길이 검증 (200바이트로 확장)
      else if (new Blob([url]).size > 200) {
        invalidBlogs.push(`${index + 1}번째: 너무 긴 URL (${new Blob([url]).size}바이트)`);
      }
    });

    if (invalidBlogs.length > 0) {
      alert(`⚠️ 블로그 주소 안에 불필요한 정보가 들어있습니다.\n\n문제가 있는 블로그 주소:\n${invalidBlogs.join('\n')}\n\n지원 형식:\n- blog.naver.com/아이디/포스트번호\n- m.blog.naver.com/아이디/포스트번호\n- blog.naver.com/PostView.naver?blogId=아이디&logNo=포스트번호\n- in.naver.com/아이디/contents/internal/포스트번호 (인플루언서)\n\nURL은 200바이트를 초과할 수 없습니다.`);
      throw new Error('블로그 URL 검증 실패');
    }

    // 최대 개수 제한 (성능 최적화)
    const MAX_KEYWORDS = 500;
    const MAX_BLOGS = 30;

    if (keywordArray.length > MAX_KEYWORDS) {
      throw new Error(`키워드는 최대 ${MAX_KEYWORDS}개까지 처리 가능합니다. (현재: ${keywordArray.length}개)`);
    }

    if (blogUrlArray.length > MAX_BLOGS) {
      throw new Error(`블로그는 최대 ${MAX_BLOGS}개까지 처리 가능합니다. (현재: ${blogUrlArray.length}개)`);
    }

    return {
      keywords: keywordArray,
      blogUrls: blogUrlArray
    };
  }

  // 키워드 중복 체크 함수
  checkKeywordDuplicates() {
    const keywordsInput = document.getElementById('keywords');
    const keywords = keywordsInput.value.trim();
    
    if (!keywords) return; // 빈 값이면 체크하지 않음
    
    const keywordArray = keywords.split('\n').map(k => k.trim()).filter(k => k);
    const uniqueKeywords = [];
    const duplicateKeywords = [];
    const keywordSet = new Set();
    
    keywordArray.forEach(keyword => {
      if (keywordSet.has(keyword)) {
        if (!duplicateKeywords.includes(keyword)) {
          duplicateKeywords.push(keyword);
        }
      } else {
        keywordSet.add(keyword);
        uniqueKeywords.push(keyword);
      }
    });
    
    if (duplicateKeywords.length > 0) {
      const removedCount = keywordArray.length - uniqueKeywords.length;
      alert(`🔄 키워드 중복 제거 완료\n\n중복된 키워드:\n${duplicateKeywords.map(k => `• ${k}`).join('\n')}\n\n${removedCount}개 항목을 제거했습니다.`);
      
      // 중복 제거된 키워드로 입력창 업데이트
      keywordsInput.value = uniqueKeywords.join('\n');
    }
  }

  // 블로그 URL 중복 체크 함수
  checkBlogUrlDuplicates() {
    const blogUrlsInput = document.getElementById('blogUrls');
    const blogUrls = blogUrlsInput.value.trim();
    
    if (!blogUrls) return; // 빈 값이면 체크하지 않음
    
    const blogUrlArray = blogUrls.split('\n').map(u => u.trim()).filter(u => u);
    const blogUrlSet = new Set();
    const duplicateBlogUrls = [];
    
    blogUrlArray.forEach(url => {
      if (blogUrlSet.has(url)) {
        if (!duplicateBlogUrls.includes(url)) {
          duplicateBlogUrls.push(url);
        }
      } else {
        blogUrlSet.add(url);
      }
    });
    
    if (duplicateBlogUrls.length > 0) {
      alert(`⚠️ 블로그 주소 중복 발견\n\n중복된 블로그 주소:\n${duplicateBlogUrls.map(u => `• ${u}`).join('\n')}\n\n중복된 블로그 주소가 있습니다.`);
    }
  }

  extractBlogId(url) {
    if (!url) return null;
    
    try {
      // URL 정리 (디코딩)
      url = decodeURIComponent(url);
    } catch (e) {
      // 디코딩 실패 시 원본 사용
    }
    
    // PostView 형태 처리
    if (url.includes('PostView.naver') || url.includes('PostView.nhn')) {
      const match = url.match(/[?&]blogId=([^&]+)/);
      return match ? match[1] : null;
    }
    
    // 인플루언서 블로그 처리
    if (url.includes('in.naver.com')) {
      const match = url.match(/in\.naver\.com\/([^\/\?#]+)/);
      return match ? match[1] : null;
    }
    
    // 일반 블로그와 모바일 블로그 처리
    const match = url.match(/(?:m\.)?blog\.naver\.com\/([^\/\?#]+)/);
    return match ? match[1] : null;
  }

  extractPostId(url) {
    if (!url) return null;
    
    try {
      // URL 정리 (디코딩)
      url = decodeURIComponent(url);
    } catch (e) {
      // 디코딩 실패 시 원본 사용
    }
    
    // 디버깅 로그 추가
    console.log(`   PostID 추출 시도: ${url}`);
    
    // PostView 형태 처리
    if (url.includes('PostView.naver') || url.includes('PostView.nhn')) {
      const match = url.match(/[?&]logNo=(\d+)/);
      const result = match ? match[1] : null;
      console.log(`   PostView 형태 -> PostID: ${result}`);
      return result;
    }
    
    // 인플루언서 블로그 처리
    if (url.includes('in.naver.com')) {
      const match = url.match(/\/contents\/internal\/(\d+)/);
      const result = match ? match[1] : null;
      console.log(`   인플루언서 형태 -> PostID: ${result}`);
      return result;
    }
    
    // 일반 블로그 형태에서 PostID 추출
    // blog.naver.com/blogId/postId 형태
    const patterns = [
      /blog\.naver\.com\/[^\/]+\/(\d{10,})(?:[?#]|$)/,   // 10자리 이상 숫자
      /blog\.naver\.com\/[^\/]+\/(\d+)(?:[?#]|$)/,       // 쿼리나 해시가 있거나 끝
      /blog\.naver\.com\/[^\/]+\/(\d+)$/,                // URL 끝에 있는 숫자
      /m\.blog\.naver\.com\/[^\/]+\/(\d{10,})/,          // 모바일 블로그 (10자리 이상)
      /m\.blog\.naver\.com\/[^\/]+\/(\d+)/,              // 모바일 블로그 (모든 숫자)
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        console.log(`   일반 블로그 형태 -> PostID: ${match[1]}`);
        return match[1];
      }
    }
    
    // 마지막 시도: URL 경로의 마지막 숫자 (10자리 이상만)
    const pathMatch = url.match(/\/(\d{10,})(?:[?#]|$)/);
    if (pathMatch) {
      console.log(`   경로 마지막 숫자 -> PostID: ${pathMatch[1]}`);
      return pathMatch[1];
    }
    
    // 네이버 리다이렉트 URL 처리 (search.naver.com/redirect)
    if (url.includes('search.naver.com') && url.includes('redirect')) {
      // 리다이렉트 URL에서는 PostID를 추출할 수 없음
      console.log(`   ❌ 리다이렉트 URL - PostID 추출 불가: ${url.substring(0, 80)}...`);
      return null;
    }
    
    console.warn(`   ❌ PostID 추출 실패: ${url}`);
    return null;
  }

    // 네이버 검색 결과에서 실제 블로그 영역만 정확히 추출
  findBlogLinks(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const blogLinks = [];
    const foundUrls = new Set();
    const foundPosts = new Set(); // BlogID + PostID 조합으로 중복 체크
    
    // 동영상 탭 제외 설정 확인
    const excludeVideoTab = document.getElementById('excludeVideoTab')?.checked !== false;
    const excludeRelatedPosts = document.getElementById('excludeRelatedPosts')?.checked !== false;
    
    // 동영상 탭/영역 제거 (설정이 활성화된 경우만)
    if (excludeVideoTab) {
      const videoElements = doc.querySelectorAll('.video, .list_video, #video, [class*="video"], [id*="video"], .sch_video, .api_video, .video_wrap, .video_area, .video_list, .videoResult, .sp_nvideo, .area_video, .video_tab, .tab_video, .type_video, .video_section, #main_pack .video');
      if (videoElements.length > 0) {
        console.log(`🚫 동영상 영역 ${videoElements.length}개 제거됨`);
        videoElements.forEach(element => {
          element.remove();
        });
      }
    }
    
    // 연관 포스팅(꼬리글) 영역 제거 (설정이 활성화된 경우만)
    if (excludeRelatedPosts) {
      const relatedElements = doc.querySelectorAll('.link_box, .related_box, .series_box, .link_item, .related_link, .series_link, [class*="link_box"], [class*="related"], [class*="series"], .more_link, .additional_link, .tail_link, .append_link, .sub_link, .extra_link');
      if (relatedElements.length > 0) {
        console.log(`🚫 연관 포스팅 영역 ${relatedElements.length}개 제거됨`);
        relatedElements.forEach(element => {
          element.remove();
        });
      }
    }
    
    console.log('🔍 블로그 검색 결과 추출 시작...');
    
    // VIEW 탭의 모든 섹션을 순서대로 처리
    const mainPack = doc.querySelector('#main_pack');
    if (!mainPack) {
      console.error('메인 검색 결과 영역을 찾을 수 없습니다.');
      return blogLinks;
    }
    
    // 모든 섹션의 링크를 순서대로 수집
    const allSections = mainPack.querySelectorAll('section, .sp_nreview, .sp_influencer, .sp_blog');
    console.log(`   발견된 섹션: ${allSections.length}개`);
    
    // 직접 main_pack에서도 링크 찾기
    const allElements = [mainPack, ...Array.from(allSections)];
    
    allElements.forEach(element => {
      // 각 요소에서 모든 링크 찾기
      const links = element.querySelectorAll('a');
      
      links.forEach(link => {
        // href 또는 data-url 속성 확인
        let href = link.getAttribute('href') || link.getAttribute('data-url');
        
        // 추가 속성들도 확인
        if (!href && link.dataset) {
          href = link.dataset.url || link.dataset.link || link.dataset.href;
        }
        
        if (!href) return;
        
        // URL 정리
        let cleanedUrl = this.cleanUrl(href);
        if (!cleanedUrl) return;
        try {
          cleanedUrl = decodeURIComponent(href);
        } catch (e) {}
        
        // 이미 처리한 URL이면 건너뛰기
        if (foundUrls.has(cleanedUrl)) return;
        
        // 블로그 플랫폼 확인 (네이버, 인플루언서, 티스토리, 다음 등)
        const isBlogUrl = (
          cleanedUrl.includes('blog.naver.com') ||
          cleanedUrl.includes('m.blog.naver.com') ||
          cleanedUrl.includes('PostView.naver') ||
          cleanedUrl.includes('in.naver.com') ||
          cleanedUrl.includes('.tistory.com') ||
          cleanedUrl.includes('blog.daum.net') ||
          cleanedUrl.includes('.blogspot.com') ||
          cleanedUrl.includes('brunch.co.kr') ||
          cleanedUrl.includes('blog.me')
        );
        
        if (isBlogUrl) {
          // 광고나 관련 링크 제외
          const parent = link.closest('.ad, .sponsor, .related, .aside, .nav, .footer, .thumb, .thumbnail');
          if (parent) return;
          
          // 네이버 블로그만 정규화, 다른 플랫폼은 그대로 유지
          let finalUrl = cleanedUrl;
          let isNaverBlog = false;
          
          if (cleanedUrl.includes('blog.naver.com') || cleanedUrl.includes('PostView.naver')) {
            finalUrl = this.normalizeUrl(cleanedUrl);
            isNaverBlog = true;
          } else if (cleanedUrl.includes('in.naver.com')) {
            // 인플루언서는 네이버 계열이지만 별도 처리
            isNaverBlog = true;
          }
          
          // PostID 추출 시도
          const blogId = this.extractBlogId(finalUrl);
          const postId = this.extractPostId(finalUrl);
          
          // PostID가 없는 링크는 건너뛰기 (썸네일 링크 등)
          if (isNaverBlog && !postId) {
            console.log(`   ⚠️ PostID 없는 링크 건너뛰기: ${finalUrl.substring(0, 60)}...`);
            return;
          }
          
          // 중복 체크 (BlogID + PostID 조합)
          const postKey = `${blogId || 'unknown'}_${postId || 'unknown'}`;
          if (foundPosts.has(postKey)) {
            console.log(`   ⚠️ 중복 링크 건너뛰기: ${postKey}`);
            return;
          }
          
          foundUrls.add(cleanedUrl);
          foundPosts.add(postKey);
          
          const platform = this.detectBlogPlatform(cleanedUrl);
          
          blogLinks.push({
            url: finalUrl,
            title: link.textContent.trim() || '제목 없음',
            isNaverBlog: isNaverBlog,
            platform: platform
          });
          
          console.log(`   ${blogLinks.length}번째: [${platform}] ${finalUrl.substring(0, 60)}...`);
        }
      });
    });
    
    // 순위 정확성을 위해 최대 20개로 확장 (1~20위까지 집계)
    const limitedResults = blogLinks.slice(0, 20);
    
    console.log(`📝 추출된 블로그 링크: ${limitedResults.length}개 (원본: ${blogLinks.length}개, 20위까지 집계)`);
    
    // 디버깅: 추출된 모든 링크 출력
    console.log('🔍 추출된 블로그 링크 상세:');
    limitedResults.forEach((link, index) => {
      if (link.isNaverBlog) {
        const blogId = this.extractBlogId(link.url);
        const postId = this.extractPostId(link.url);
        console.log(`  ${index + 1}위: [네이버] ${link.url}`);
        console.log(`       BlogID: ${blogId}, PostID: ${postId}`);
      } else {
        console.log(`  ${index + 1}위: [${link.platform}] ${link.url}`);
      }
    });
    
    return limitedResults;
  }
  
  // 블로그 플랫폼 감지
  detectBlogPlatform(url) {
    if (url.includes('blog.naver.com') || url.includes('PostView.naver')) return '네이버';
    if (url.includes('.tistory.com')) return '티스토리';
    if (url.includes('blog.daum.net')) return '다음';
    if (url.includes('brunch.co.kr')) return '브런치';
    if (url.includes('.blogspot.com')) return '블로거';
    if (url.includes('in.naver.com')) return '인플루언서';
    return '기타';
  }

  // URL 정리 함수
  cleanUrl(url) {
    if (!url) return null;
    
    console.log(`     원본 URL: ${url}`);
    
    // URL 디코딩
    try {
      url = decodeURIComponent(url);
    } catch (e) {
      // 디코딩 실패 시 원본 사용
    }
    
    // 네이버 리다이렉트 URL 처리
    if (url.includes('search.naver.com') && url.includes('url=')) {
      const match = url.match(/url=([^&]+)/);
      if (match) {
        try {
          url = decodeURIComponent(match[1]);
          console.log(`     리다이렉트에서 추출: ${url}`);
        } catch (e) {
          url = match[1];
        }
      }
    }
    
    // cr.shopping.naver.com 등의 리다이렉트 처리
    if (url.includes('cr.') && url.includes('url=')) {
      const match = url.match(/url=([^&]+)/);
      if (match) {
        try {
          url = decodeURIComponent(match[1]);
          console.log(`     cr 리다이렉트에서 추출: ${url}`);
        } catch (e) {
          url = match[1];
        }
      }
    }
    
    // 네이버 새 형태의 리다이렉트 처리 (redirect?...)
    if (url.includes('/redirect') || url.includes('?redirect')) {
      // 리다이렉트 URL에서는 직접 추출이 어려움
      console.log(`     ⚠️ 리다이렉트 URL 감지 - 원본 유지`);
      return url;
    }
    
    // 블로그 URL의 경우 쿼리 파라미터 제거 (하지만 PostView는 예외)
    if (!url.includes('PostView.naver')) {
      url = url.split('?')[0].split('#')[0];
    }
    
    console.log(`     정리된 URL: ${url}`);
    
    return url;
  }

  // 유효한 블로그 URL인지 확인
  isValidBlogUrl(url) {
    const patterns = [
      /^https?:\/\/blog\.naver\.com\/[a-zA-Z0-9_\-\.]+\/\d+$/,                    // 일반 네이버 블로그
      /^https?:\/\/m\.blog\.naver\.com\/[a-zA-Z0-9_\-\.]+\/\d+$/,                 // 모바일 네이버 블로그
      /^https?:\/\/blog\.naver\.com\/PostView\.naver\?.*blogId=.*&logNo=\d+/,     // PostView 형태
      /^https?:\/\/[a-zA-Z0-9_\-\.]+\.blog\.me\/\d+$/,                            // 구 블로그미 형식
      /^https?:\/\/in\.naver\.com\/[a-zA-Z0-9_\-\.]+\/contents\/internal\/\d+/    // 인플루언서 블로그
    ];
    
    return patterns.some(pattern => pattern.test(url));
  }

  // 캐싱된 네이버 검색 결과 가져오기
  async fetchNaverSearchResults(keyword, retryAttempt = 0) {
    // 캐시 확인 (재시도가 아닌 경우만)
    if (retryAttempt === 0 && this.searchCache.has(keyword)) {
      console.log(`💾 캐시에서 불러옴: ${keyword}`);
      return this.searchCache.get(keyword);
    }

    // 선택된 서버 목록 사용
    const proxyServers = Array.from(this.selectedServers);
    
    if (proxyServers.length === 0) {
      throw new Error('선택된 프록시 서버가 없습니다. 서버를 선택해주세요.');
    }
    
    // 재시도 시 서버 순서를 섞어서 다른 서버부터 시도
    if (retryAttempt > 0) {
      proxyServers.sort(() => Math.random() - 0.5);
    }
    
    const naverBlogUrl = `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(keyword)}`;
    
    const proxyErrors = [];
    
    // 프록시별 연결 시도
    for (let i = 0; i < proxyServers.length; i++) {
      const proxy = proxyServers[i];
      const proxyName = proxy.split('/')[2].split('.')[0]; // 짧은 이름 추출
      
      try {
        // 실시간 프록시 연결 상태 업데이트
        this.updateProxyStatus(`프록시 연결 시도: ${proxyName} (${i+1}/${proxyServers.length})`);
        
        // 짧은 타임아웃으로 빠른 처리 (5초, 6초, 7초...)
        const timeout = 5000 + (i * 1000);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        // 연결 중 상태 업데이트
        setTimeout(() => {
          if (!controller.signal.aborted) {
            this.updateProxyStatus(`프록시 연결 중: ${proxyName} (응답 대기 중...)`);
          }
        }, 1000);
        
        const response = await fetch(proxy + encodeURIComponent(naverBlogUrl), {
          headers: {
            'Content-Type': 'text/html',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://search.naver.com/'
          },
          signal: this.searchAbortController ? this.searchAbortController.signal : controller.signal,
          mode: 'cors'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          // 연결 성공 상태 업데이트
          this.updateProxyStatus(`연결 성공: ${proxyName} (데이터 수신 중...)`);
          
          const html = await response.text();
          
          // 성공한 프록시 정보 저장
          if (!this.workingProxies) this.workingProxies = new Set();
          this.workingProxies.add(proxy);
          this.lastUsedProxy = proxyName; // 마지막 사용 프록시 저장
          
          // 완료 상태 업데이트
          this.updateProxyStatus(`연결됨: ${proxyName} (${html.length.toLocaleString()}자 수신)`);
          
          // 캐시에 저장
          this.searchCache.set(keyword, html);
          
          return html;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        let errorMsg = error.name === 'AbortError' ? '타임아웃' : 
                      error.message.includes('CORS') ? 'CORS 정책 차단' :
                      error.message.includes('429') ? '요청 한도 초과' :
                      error.message.includes('Failed to fetch') ? '네트워크 연결 실패' :
                      error.message.includes('ERR_CONNECTION_REFUSED') ? '서버 연결 불가' :
                      error.message;
        
        // 실패 상태 업데이트
        this.updateProxyStatus(`연결 실패: ${proxyName} (${errorMsg})`);
        proxyErrors.push(`${proxyName}: ${errorMsg}`);
        
        // 실패한 프록시는 캐시에서 제거
        if (this.failedProxies) {
          this.failedProxies.add(proxy);
        } else {
          this.failedProxies = new Set([proxy]);
        }
        
        // 잠시 대기 후 다음 프록시 시도
        await new Promise(resolve => setTimeout(resolve, 800));
        continue;
      }
    }
    
    // 모든 프록시 실패 시 상세 에러 정보 제공
    const errorDetails = proxyErrors.map((err, i) => `${i+1}. ${err}`).join(' | ');
    const retryInfo = retryAttempt > 0 ? ` (재시도 ${retryAttempt}회차)` : '';
    throw new Error(`모든 ${proxyServers.length}개 프록시 서버 연결 실패${retryInfo}. 에러: ${errorDetails}`);
  }

  // 배치 처리를 위한 키워드 검색
  async processBatch(keywords, batchSize = null) {
    // batchSize가 없으면 선택된 서버 수 사용
    if (!batchSize) {
      batchSize = Math.max(1, this.selectedServers.size);
    }
    
    const results = [];
    const totalBatches = Math.ceil(keywords.length / batchSize);
    
    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);
      const batchNum = Math.floor(i/batchSize) + 1;
      
      const proxyInfo = this.lastUsedProxy ? `연결됨: ${this.lastUsedProxy}` : '프록시 연결 중...';
      this.updateProgress(i, keywords.length, `배치 ${batchNum}/${totalBatches} 처리 중...`, proxyInfo);
      
      const batchPromises = batch.map(async (keyword, keywordIndex) => {
        const MAX_RETRIES = 3; // 최대 재시도 횟수
        let retryCount = 0;
        
        while (retryCount < MAX_RETRIES) {
          try {
            // 개별 키워드 처리 시작 알림
            const globalIndex = i + keywordIndex;
            const retryInfo = retryCount > 0 ? ` (재시도 ${retryCount}/${MAX_RETRIES})` : '';
            this.updateProgress(globalIndex, keywords.length, `"${keyword}" 검색 중${retryInfo}...`, `키워드 처리 시작: ${keyword}`);
            
            this.currentProgressInfo = { keyword, proxyInfo: '' };
            const html = await this.fetchNaverSearchResults(keyword, retryCount);
            
            // 블로그 링크 추출 중 상태 업데이트
            this.updateProxyStatus(`"${keyword}" 분석 중... (HTML 파싱)`);
            const blogLinks = this.findBlogLinks(html);
            
            // 완료 상태 업데이트
            this.updateProxyStatus(`"${keyword}" 완료 (${blogLinks.length}개 블로그 발견)`);
            
            return { keyword, blogLinks, error: null };
          } catch (error) {
            retryCount++;
            
            if (retryCount >= MAX_RETRIES) {
              // 모든 재시도 실패
              this.updateProxyStatus(`"${keyword}" 최종 실패 (${MAX_RETRIES}회 재시도 완료)`);
              console.error(`❌ "${keyword}" 검색 최종 실패:`, error.message);
              return { keyword, blogLinks: [], error: `${error.message} (${MAX_RETRIES}회 재시도 실패)` };
            } else {
              // 재시도 대기
              const waitTime = retryCount * 2000; // 2초, 4초 대기
              this.updateProxyStatus(`"${keyword}" 실패, ${waitTime/1000}초 후 재시도... (${retryCount}/${MAX_RETRIES})`);
              console.warn(`⚠️ "${keyword}" 검색 실패, 재시도 ${retryCount}/${MAX_RETRIES}:`, error.message);
              
              // 캐시 삭제 (재시도 시 새로 가져오기)
              if (this.searchCache.has(keyword)) {
                this.searchCache.delete(keyword);
              }
              
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // 프로그래스 업데이트
      const completedCount = Math.min(i + batchSize, keywords.length);
      const finalProxyInfo = this.lastUsedProxy ? `사용 프록시: ${this.lastUsedProxy}` : '';
      this.updateProgress(completedCount, keywords.length, `${completedCount}/${keywords.length} 키워드 처리 완료`, finalProxyInfo);
      
      // 배치 간 짧은 지연
      if (i + batchSize < keywords.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results;
  }

  // URL 정규화 함수 (모바일/일반 형태 통일)
  normalizeUrl(url) {
    if (!url) return url;
    
    // 모바일 URL을 일반 URL로 변환
    url = url.replace('m.blog.naver.com', 'blog.naver.com');
    
    // PostView 형태를 일반 형태로 변환
    if (url.includes('PostView.naver')) {
      const blogIdMatch = url.match(/[?&]blogId=([^&]+)/);
      const logNoMatch = url.match(/[?&]logNo=(\d+)/);
      if (blogIdMatch && logNoMatch) {
        return `https://blog.naver.com/${blogIdMatch[1]}/${logNoMatch[1]}`;
      }
    }
    
    return url;
  }

  findRank(targetUrl, blogLinks) {
    const targetBlogId = this.extractBlogId(targetUrl);
    const targetPostId = this.extractPostId(targetUrl);
    const normalizedTarget = this.normalizeUrl(targetUrl);
    
    console.log(`🎯 순위 검색 중: ${targetUrl}`);
    console.log(`   정규화된 URL: ${normalizedTarget}`);
    console.log(`   대상 BlogID: "${targetBlogId}", PostID: "${targetPostId}"`);
    
    // 전체 검색 결과 디버깅 (첫 20개)
    console.log(`📋 전체 검색 결과 (상위 20개):`);
    blogLinks.slice(0, 20).forEach((link, index) => {
      if (link.isNaverBlog) {
        const linkBlogId = this.extractBlogId(link.url);
        const linkPostId = this.extractPostId(link.url);
        console.log(`   ${index + 1}위: BlogID="${linkBlogId}", PostID="${linkPostId}"`);
        if (linkBlogId === targetBlogId) {
          console.log(`      → 같은 블로그! (PostID: ${linkPostId} vs 찾는 PostID: ${targetPostId})`);
        }
      }
    });
    
    // PostID가 없으면 경고하고 검색 중단
    if (!targetPostId) {
      console.error(`   ❌ PostID를 찾을 수 없습니다. URL을 확인해주세요.`);
      return { found: false, position: null, error: 'PostID를 찾을 수 없습니다' };
    }
    
    // 찾고자 하는 정확한 PostID (문자열로 변환)
    const targetPostIdStr = String(targetPostId).trim();
    const targetBlogIdStr = targetBlogId ? String(targetBlogId).toLowerCase().trim() : '';
    
    console.log(`   🔍 찾는 게시물: BlogID="${targetBlogIdStr}", PostID="${targetPostIdStr}"`);
    console.log(`   📋 검색 대상 ${blogLinks.length}개 블로그 링크 (모든 플랫폼 포함)`);
    
    // 네이버 블로그만 필터링하여 매칭
    const naverBlogPosts = [];
    blogLinks.forEach((link, index) => {
      // 네이버 블로그인 경우만 처리
      if (link.isNaverBlog !== false && 
          (link.url.includes('blog.naver.com') || 
           link.url.includes('PostView.naver') || 
           link.url.includes('in.naver.com'))) {
        
        const linkBlogId = this.extractBlogId(link.url);
        const linkBlogIdStr = linkBlogId ? String(linkBlogId).toLowerCase().trim() : '';
        
        if (linkBlogIdStr === targetBlogIdStr) {
          const linkPostId = this.extractPostId(link.url);
          naverBlogPosts.push({
            index: index,
            url: link.url,
            postId: linkPostId,
            postIdStr: linkPostId ? String(linkPostId).trim() : ''
          });
        }
      }
    });
    
    console.log(`   📊 같은 네이버 블로그의 게시물 ${naverBlogPosts.length}개 발견`);
    
    if (naverBlogPosts.length === 0) {
      console.log(`   ❌ 순위권 밖 - 해당 블로그를 찾지 못함`);
      return { found: false, position: null };
    }
    
    // PostID 정확 비교
    console.log(`   🔎 PostID 정확 비교 모드`);
    
    for (const post of naverBlogPosts) {
      console.log(`   ${post.index + 1}위: ${post.url}`);
      console.log(`        PostID: "${post.postIdStr}" vs "${targetPostIdStr}"`);
      
      if (post.postIdStr === targetPostIdStr) {
        console.log(`   🎉 정확한 PostID 매칭! ${post.index + 1}위로 발견`);
        return { found: true, position: post.index + 1 };
      }
    }
    
    // PostID가 일치하는 게시물이 없음
    console.log(`   ❌ 같은 블로그의 다른 게시물들만 발견됨 (원하는 PostID: ${targetPostIdStr})`);
    console.log(`   발견된 PostID들: ${naverBlogPosts.map(p => p.postIdStr).join(', ')}`);
    return { found: false, position: null };
  }

  displayResults(results, totalBlogs, debugInfo = null) {
    const resultsDiv = document.getElementById('resultsList');
    
    // 발견된 블로그와 찾지 못한 블로그 개수
    const foundCount = results.filter(r => r.rank.found).length;
    const notFoundCount = results.length - foundCount;
    
    let html = `
      <div class="summary">
        <h3>📊 검색 결과 요약</h3>
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-number">${totalBlogs}</span>
            <span class="stat-label">총 발견된 블로그</span>
        </div>
          <div class="stat-item">
            <span class="stat-number">${foundCount}</span>
            <span class="stat-label">순위 발견</span>
      </div>
          <div class="stat-item">
            <span class="stat-number">${notFoundCount}</span>
            <span class="stat-label">순위권 밖</span>
        </div>
        </div>
        </div>
    `;

    // 디버깅 정보 표시 (발견된 블로그가 없을 때)
    if (totalBlogs === 0 && debugInfo) {
      html += `
        <div class="error-message">
          <h4>⚠️ 블로그를 찾을 수 없습니다</h4>
          <p><strong>해결 방법:</strong></p>
          <ol>
            <li>네이버에서 키워드를 검색하세요</li>
            <li>검색 결과 페이지에서 <strong>블로그 탭</strong>을 클릭하세요</li>
            <li>F12를 눌러 개발자 도구를 여세요</li>
            <li>Elements 탭에서 <strong>&lt;html&gt;</strong> 태그를 우클릭 → Copy → Copy outerHTML</li>
            <li>복사한 HTML을 여기에 붙여넣으세요</li>
          </ol>
          <p><strong>확인된 HTML 길이:</strong> ${debugInfo.htmlLength}자</p>
          <p><strong>시도한 셀렉터들:</strong> ${debugInfo.selectors.join(', ')}</p>
          </div>
      `;
    }

    // 개별 결과 표시
    results.forEach(result => {
      const statusClass = result.rank.found ? '' : 'not-found';
      const rankText = result.rank.found ? `${result.rank.position}위` : '순위권 밖';
      
      // 순위 노출이 안된 항목은 미리 카운트 1로 설정 (없는 경우에만)
      const buttonKey = `${result.blogUrl}_${result.keywords}`;
      if (!result.rank.found) {
        // 클릭 카운트 맵 초기화 (없으면 생성)
        if (!this.previewClickCounts) {
          this.previewClickCounts = new Map();
        }
        // 이미 값이 있으면 유지, 없으면 1로 설정
        if (!this.previewClickCounts.has(buttonKey)) {
          this.previewClickCounts.set(buttonKey, 1);
        }
      }
      
      // 현재 클릭 카운트에 따라 클래스 설정
      const currentCount = this.previewClickCounts?.get(buttonKey) || 0;
      let clickedClass = '';
      if (currentCount === 1) {
        clickedClass = 'clicked-once';
      } else if (currentCount === 2) {
        clickedClass = 'clicked-twice';
      }
      
      html += `
        <div class="result-item ${statusClass}">
          <div class="result-header">
            <div class="keyword">🔍 키워드: ${result.keywords}</div>
            <div class="header-right">
              <div class="rank-badge ${statusClass}">${rankText}</div>
              <button class="preview-btn ${clickedClass}" onclick="window.blogRankChecker.showPreview('${result.blogUrl.replace(/'/g, "\\'")}', '${result.keywords.replace(/'/g, "\\'")}')">
                미리보기
              </button>
            </div>
        </div>
          <div class="blog-url">
            📝 <a href="${result.blogUrl}" target="_blank" class="blog-link">${result.blogUrl}</a>
        </div>
          ${result.rank.found ? `<div class="match-info">✅ 정확히 일치하는 블로그 포스트를 찾았습니다!</div>` : ''}
      </div>
    `;
    });

    // 발견된 모든 블로그 링크 표시 (디버깅용)
    if (debugInfo && debugInfo.foundBlogs && debugInfo.foundBlogs.length > 0) {
      html += `
        <div class="debug-info" style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
          <h4>🔍 발견된 모든 블로그 (총 ${debugInfo.foundBlogs.length}개)</h4>
          <div style="max-height: 200px; overflow-y: auto; font-size: 0.9em;">
            ${debugInfo.foundBlogs.map((blog, index) => `
              <div style="margin: 5px 0; padding: 5px; border-left: 3px solid #007bff;">
                <strong>${index + 1}위:</strong> <a href="${blog.url}" target="_blank" style="color: #007bff;">${blog.url}</a>
                <br><small style="color: #666;">제목: ${blog.title}</small>
        </div>
            `).join('')}
        </div>
      </div>
    `;
    }

    resultsDiv.innerHTML = html;
    document.getElementById('results').style.display = 'block';
  }

  // 키워드별 결과 표시 (새로운 방식)
  displayKeywordResults(allResults, debugInfo) {
    const resultsDiv = document.getElementById('resultsList');
    
    // 전체 통계 계산
    const totalSearches = allResults.length;
    const foundCount = allResults.filter(r => r.rank.found).length;
    const errorCount = allResults.filter(r => r.rank.error).length;
    
    let html = `
      <div class="summary">
        <h3>🎯 검색 결과 요약</h3>
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-number">${debugInfo.totalKeywords}</span>
            <span class="stat-label">검색한 키워드</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">${foundCount}</span>
            <span class="stat-label">순위 발견</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">${debugInfo.totalBlogsFound}</span>
            <span class="stat-label">총 블로그 결과</span>
          </div>
        </div>

      </div>
    `;

    // 키워드별로 그룹화하여 표시
    const groupedResults = {};
    allResults.forEach(result => {
      if (!groupedResults[result.keyword]) {
        groupedResults[result.keyword] = [];
      }
      groupedResults[result.keyword].push(result);
    });

    Object.entries(groupedResults).forEach(([keyword, results]) => {
      const keywordFoundCount = results.filter(r => r.rank.found).length;
      const totalBlogsInKeyword = results[0]?.totalBlogsInKeyword || 0;
      
      html += `
        <div class="keyword-section" style="margin-bottom: 25px; border: 1px solid #e9ecef; border-radius: 10px; overflow: hidden;">
          <div class="keyword-header" style="background: linear-gradient(45deg, #667eea, #764ba2); color: white; padding: 15px;">
            <h4 style="margin: 0; font-size: 1.2em;">🔍 "${keyword}"</h4>
            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 0.9em;">
              총 ${totalBlogsInKeyword}개 블로그 중 ${keywordFoundCount}개 발견
            </p>
          </div>
          <div class="keyword-results" style="padding: 15px;">
      `;
      
      results.forEach(result => {
        const statusClass = result.rank.found && result.rank.position <= 20 ? '' : 'not-found';
        const rankText = result.rank.found && result.rank.position <= 20 ? `${result.rank.position}위` : 
                        result.rank.error ? `검색 실패` : '순위권 밖';
        
        // 순위 노출이 안된 항목은 미리 카운트 1로 설정 (없는 경우에만)
        const buttonKey = `${result.blogUrl}_${keyword}`;
        const isNotFound = !(result.rank.found && result.rank.position <= 20);
        if (isNotFound) {
          // 클릭 카운트 맵 초기화 (없으면 생성)
          if (!this.previewClickCounts) {
            this.previewClickCounts = new Map();
          }
          // 이미 값이 있으면 유지, 없으면 1로 설정
          if (!this.previewClickCounts.has(buttonKey)) {
            this.previewClickCounts.set(buttonKey, 1);
          }
        }
        
        // 현재 클릭 카운트에 따라 클래스 설정
        const currentCount = this.previewClickCounts?.get(buttonKey) || 0;
        let clickedClass = '';
        if (currentCount === 1) {
          clickedClass = 'clicked-once';
        } else if (currentCount === 2) {
          clickedClass = 'clicked-twice';
        }
        
        html += `
          <div class="result-item ${statusClass}" style="margin-bottom: 10px;">
            <div class="result-header">
              <div class="blog-info" style="flex: 1;">
                📝 <a href="${result.blogUrl}" target="_blank" class="blog-link">${result.blogUrl}</a>
              </div>
              <div class="header-right">
                <div class="rank-badge ${statusClass}">${rankText}</div>
                <button class="preview-btn ${clickedClass}" onclick="window.blogRankChecker.showPreview('${result.blogUrl.replace(/'/g, "\\'")}', '${keyword.replace(/'/g, "\\'")}')">
                  미리보기
                </button>
              </div>
            </div>
            ${result.rank.found && result.rank.position <= 20 ? 
              `<div class="match-info" style="margin-top: 8px; color: #28a745; font-size: 0.9em;">
                ✅ ${result.totalBlogsInKeyword}개 중 ${result.rank.position}번째로 발견!
              </div>` : 
              result.rank.error ? 
              `<div class="error-info" style="margin-top: 8px; color: #dc3545; font-size: 0.9em;">
                ❌ ${result.rank.error}
              </div>` : ''
            }
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    });



    resultsDiv.innerHTML = html;
    document.getElementById('results').style.display = 'block';
  }

  // 대량 데이터를 위한 테이블 형태 결과 표시
  displayTableResults(allResults, stats) {
    const resultsDiv = document.getElementById('resultsList');
    
    // 통계 요약
    const avgSearchTime = (stats.searchTime / stats.totalKeywords).toFixed(0);
    
    let html = `
      <div class="stats-summary" style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; text-align: center;">
          <div class="stat-card">
            <div class="stat-number" style="font-size: 2em; font-weight: bold; color: #667eea;">${stats.totalKeywords}</div>
            <div class="stat-label">키워드</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="font-size: 2em; font-weight: bold; color: #667eea;">${stats.totalBlogUrls}</div>
            <div class="stat-label">블로그</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="font-size: 2em; font-weight: bold; color: #28a745;">${stats.foundCount}</div>
            <div class="stat-label">순위 발견</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="font-size: 2em; font-weight: bold; color: #fd7e14;">${(stats.searchTime/1000).toFixed(1)}s</div>
            <div class="stat-label">처리 시간</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="font-size: 2em; font-weight: bold; color: #6f42c1;">${stats.cacheHits}</div>
            <div class="stat-label">캐시 적중</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="font-size: 2em; font-weight: bold; color: #17a2b8;">${stats.workingProxies}/${stats.totalProxies}</div>
            <div class="stat-label">활성 프록시</div>
          </div>
        </div>
      </div>

      <!-- 툴팁 스타일 추가 -->
      <style>
        .editable-rank:hover {
          background: #f8f9fa !important;
          box-shadow: 0 0 3px rgba(102, 126, 234, 0.5);
        }
        .editable-rank:focus {
          background: #f0f8ff !important;
          outline: 2px solid #667eea !important;
        }
        .edit-indicator {
          margin-left: 2px;
          opacity: 0.7;
        }
        .tooltip {
          position: absolute;
          background-color: #333;
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          max-width: 250px;
          z-index: 1000;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s;
          line-height: 1.4;
        }
        .tooltip.show {
          opacity: 1;
        }
        .tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-top-color: #333;
        }
        .tooltip.bottom::after {
          top: -10px;
          border-top-color: transparent;
          border-bottom-color: #333;
        }
        .help-icon:hover {
          color: #007bff !important;
          transform: scale(1.1);
          transition: all 0.2s;
        }
      </style>

      <div class="table-controls" style="margin-bottom: 15px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <select id="filterStatus" style="padding: 8px; border-radius: 5px; border: 1px solid #ddd;">
          <option value="all">전체 결과</option>
          <option value="top-rank">상위권노출 (1-3위)</option>
          <option value="mid-rank">하위권노출 (4-7위)</option>
          <option value="low-rank">확인필요 (8-20위)</option>
          <option value="notfound">순위권밖 (21위~)</option>
          <option value="error">검색실패</option>
        </select>
        <select id="sortBy" style="padding: 8px; border-radius: 5px; border: 1px solid #ddd;">
          <option value="recommended" selected>추천순 (기본)</option>
          <option value="keyword">키워드순</option>
          <option value="rank">순위순</option>
          <option value="blog">블로그순</option>
        </select>
        <button onclick="window.blogChecker.exportResults()" style="padding: 8px 15px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">📊 XLSX 내보내기</button>
        <button onclick="window.blogRankChecker.retryFailedKeywords()" style="padding: 8px 15px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;" title="${stats.failedKeywords && stats.failedKeywords.length > 0 ? `실패한 ${stats.failedKeywords.length}개 키워드 재시도` : '전체 키워드 재검색'}">
          🔄 ${stats.failedKeywords && stats.failedKeywords.length > 0 ? `실패한 키워드 재시도 (${stats.failedKeywords.length}개)` : '전체 재검색'}
        </button>
        
        <div style="margin-left: auto; display: flex; gap: 5px;">
          <button id="viewModeIndividual" class="view-mode-btn active" style="padding: 8px 12px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 0.9em;">개별보기</button>
          <button id="viewModeSummary" class="view-mode-btn" style="padding: 8px 12px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 0.9em;">전체보기</button>
        </div>
      </div>

      <div class="results-table-container" style="max-height: 600px; overflow-y: auto; border: 1px solid #ddd; border-radius: 8px;">
        <table class="results-table resizable-table" style="width: 100%; border-collapse: collapse; font-size: 0.9em; table-layout: fixed;">
          <colgroup>
            <col style="width: 20%;">
            <col style="width: 22%;">
            <col style="width: 9%;">
            <col style="width: 12%;">
            <col style="width: 14%;">
            <col style="width: 14%;">
            <col style="width: 9%;">
          </colgroup>
          <thead style="background: #f8f9fa; position: sticky; top: 0; z-index: 10;">
            <tr>
              <th class="resizable-th" style="padding: 12px; border-bottom: 2px solid #ddd; text-align: left; position: relative;">
                키워드 
                <span title="사용자가 검색한 키워드를 뜻 합니다." style="margin-left: 4px; cursor: help; color: #666; font-size: 12px; font-weight: normal;">ⓘ</span>
                <div class="resize-handle"></div>
              </th>
              <th class="resizable-th" style="padding: 12px; border-bottom: 2px solid #ddd; text-align: left; position: relative;">
                블로그 URL 
                <span title="blog.naver.com/을 제외한 사용자 아이디를 뜻합니다." style="margin-left: 4px; cursor: help; color: #666; font-size: 12px; font-weight: normal;">ⓘ</span>
                <div class="resize-handle"></div>
              </th>
              <th class="resizable-th" style="padding: 12px; border-bottom: 2px solid #ddd; text-align: center; position: relative;">
                순위 
                <span title="총 결과 중 해당 블로그가 몇번째로 출력 되는지를 뜻합니다. (1~20위까지만 집계)" style="margin-left: 4px; cursor: help; color: #666; font-size: 12px; font-weight: normal;">ⓘ</span>
                <div class="resize-handle"></div>
              </th>
              <th class="resizable-th" style="padding: 12px; border-bottom: 2px solid #ddd; text-align: center; position: relative;">
                총 결과 
                <span title="키워드 검색 결과 중 블로그 게시물이 총 몇 개인지를 뜻합니다." style="margin-left: 4px; cursor: help; color: #666; font-size: 12px; font-weight: normal;">ⓘ</span>
                <div class="resize-handle"></div>
              </th>
              <th class="resizable-th" style="padding: 12px; border-bottom: 2px solid #ddd; text-align: center; position: relative;">
                상태 
                <span title="1~3위는 상위권노출, 4~7위는 하위권노출, 8~20위는 확인필요, 21위 이상은 순위권밖입니다." style="margin-left: 4px; cursor: help; color: #666; font-size: 12px; font-weight: normal;">ⓘ</span>
                <div class="resize-handle"></div>
              </th>
              <th style="padding: 12px; border-bottom: 2px solid #ddd; text-align: center;">
                미리보기
                <span title="네이버 블로그 검색 페이지를 새 창에서 열고, 해당 블로그를 빨간 테두리로 하이라이트 표시합니다." style="margin-left: 4px; cursor: help; color: #666; font-size: 12px; font-weight: normal;">ⓘ</span>
              </th>
              <th style="padding: 12px; border-bottom: 2px solid #ddd; text-align: center;">
                숨기기
                <span title="체크된 키워드는 전체보기에서 제외됩니다." style="margin-left: 4px; cursor: help; color: #666; font-size: 12px; font-weight: normal;">ⓘ</span>
              </th>
            </tr>
          </thead>
          <tbody id="resultsTableBody">
    `;

    // 결과 정렬: 추천순 (순위 있는 것들 위로 → 순위권 밖은 모두 아래로)
    const sortedResults = allResults.sort((a, b) => {
      // 1순위: 순위 발견 여부 (순위 있는 것들을 모두 위로)
      if (a.rank.found && !b.rank.found) return -1;
      if (!a.rank.found && b.rank.found) return 1;
      
      // 2순위: 둘 다 순위가 있는 경우
      if (a.rank.found && b.rank.found) {
        // 키워드 알파벳 순으로 먼저 정렬
        const keywordCompare = a.keyword.localeCompare(b.keyword);
        if (keywordCompare !== 0) return keywordCompare;
        
        // 같은 키워드 내에서는 순위순 (1위가 맨 위)
        return a.rank.position - b.rank.position;
      }
      
      // 3순위: 둘 다 순위가 없는 경우 (모두 아래쪽에 배치)
      if (!a.rank.found && !b.rank.found) {
        // 키워드 알파벳 순으로 먼저 정렬
        const keywordCompare = a.keyword.localeCompare(b.keyword);
        if (keywordCompare !== 0) return keywordCompare;
        
        // 같은 키워드 내에서는 블로그 이름 순
        return a.blogUrl.localeCompare(b.blogUrl);
      }
      
      return 0;
    });

    // 테이블 행 생성
    sortedResults.forEach((result, index) => {
      let statusClass, statusText, statusColor;
      
      // 순위 노출이 안된 항목은 미리 카운트 1로 설정 (없는 경우에만)
      const buttonKey = `${result.blogUrl}_${result.keyword}`;
      const isNotFound = !(result.rank.found && result.rank.position <= 20);
      if (isNotFound) {
        // 클릭 카운트 맵 초기화 (없으면 생성)
        if (!this.previewClickCounts) {
          this.previewClickCounts = new Map();
        }
        // 이미 값이 있으면 유지, 없으면 1로 설정
        if (!this.previewClickCounts.has(buttonKey)) {
          this.previewClickCounts.set(buttonKey, 1);
        }
      }
      
      // 현재 클릭 카운트에 따라 클래스 설정
      const currentCount = this.previewClickCounts?.get(buttonKey) || 0;
      let clickedClass = '';
      if (currentCount === 1) {
        clickedClass = ' clicked-once';
      } else if (currentCount === 2) {
        clickedClass = ' clicked-twice';
      }
      
      if (result.rank.found) {
        const rank = result.rank.position;
        if (rank <= 3) {
          statusClass = 'top-rank';
          statusText = '상위권노출';
          statusColor = '#28a745'; // 초록색
        } else if (rank <= 7) {
          statusClass = 'mid-rank';
          statusText = '하위권노출';
          statusColor = '#f39c12'; // 주황색 (가독성 개선)
        } else if (rank <= 20) {
          statusClass = 'low-rank';
          statusText = '확인필요';
          statusColor = '#dc3545'; // 빨간색
        } else {
          // 21위 이상은 순위권 밖으로 처리
          statusClass = 'notfound';
          statusText = '-';
          statusColor = '#6c757d'; // 회색
        }
      } else if (result.rank.error) {
        statusClass = 'error';
        statusText = '검색실패';
        statusColor = '#6c757d'; // 회색
      } else {
        statusClass = 'notfound';
        statusText = '-';
        statusColor = '#6c757d'; // 회색
      }
      
      const blogName = result.blogUrl.match(/blog\.naver\.com\/([^\/]+)/)?.[1] || 
                      result.blogUrl.match(/([^\/]+)\.blog\.me/)?.[1] || 
                      'Unknown';
      
      html += `
        <tr class="result-row" data-status="${statusClass}" data-keyword="${result.keyword}" data-blog="${blogName}" style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${result.keyword}">
            ${result.keyword}
          </td>
          <td style="padding: 10px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <a href="${result.blogUrl}" target="_blank" style="color: #667eea; text-decoration: none;" title="${result.blogUrl}">
              ${blogName}
            </a>
          </td>
          <td style="padding: 10px; text-align: center; font-weight: bold;">
            <div contenteditable="true" 
                 class="editable-rank" 
                 data-original-rank="${result.rank.found && result.rank.position <= 20 ? result.rank.position : '-'}"
                 data-keyword="${result.keyword.replace(/"/g, '&quot;')}"
                 data-blog="${result.blogUrl.replace(/"/g, '&quot;')}"
                 style="color: ${statusColor}; min-width: 30px; display: inline-block; padding: 2px 5px; border-radius: 3px; cursor: text;"
                 onfocus="window.blogRankChecker.onRankEditStart(this)"
                 onblur="window.blogRankChecker.onRankEditEnd(this)"
                 onkeydown="window.blogRankChecker.onRankKeydown(event, this)">
              ${result.rank.found && result.rank.position <= 20 ? result.rank.position : '-'}
            </div>
          </td>
          <td style="padding: 10px; text-align: center;">
            ${result.totalBlogsInKeyword || '-'}
          </td>
          <td style="padding: 10px; text-align: center;">
            <span style="padding: 4px 8px; border-radius: 12px; font-size: 0.8em; color: white; background: ${statusColor};">
              ${statusText}
            </span>
          </td>
          <td style="padding: 10px; text-align: center;">
            <button class="preview-btn${clickedClass}" onclick="window.blogRankChecker.showPreview('${result.blogUrl.replace(/'/g, "\\'")}', '${result.keyword.replace(/'/g, "\\'")}')">
              미리보기
            </button>
          </td>
          <td style="padding: 10px; text-align: center;">
            <input type="checkbox" class="keyword-hide-checkbox" 
                   data-keyword="${result.keyword.replace(/"/g, '&quot;')}" 
                   data-blog="${result.blogUrl.replace(/"/g, '&quot;')}"
                   onchange="window.blogRankChecker.toggleKeywordVisibility('${result.keyword.replace(/'/g, "\\'")}', '${result.blogUrl.replace(/'/g, "\\'")}')"
                   style="transform: scale(1.3); cursor: pointer;">
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
      
      <div class="table-summary" style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px; text-align: center; font-size: 0.9em; color: #666;">
        ${(() => {
          // 첫 번째 결과 생성 시에만 시간 정보 설정하고, 이후에는 캐시된 값 사용
          if (!this.cachedTimeInfo) {
            const completedTime = new Date().toLocaleTimeString('ko-KR');
            const totalElapsed = this.startTime ? Date.now() - this.startTime : 0;
            const totalMin = Math.floor(totalElapsed / 60000);
            const totalSec = Math.floor((totalElapsed % 60000) / 1000);
            const totalTimeStr = totalMin > 0 ? `${totalMin}분 ${totalSec}초` : `${totalSec}초`;
            
            this.cachedTimeInfo = {
              completedTime,
              totalTimeStr,
              avgSearchTime
            };
          }
          
          return `총 ${allResults.length}개 결과 | 평균 검색 시간: ${this.cachedTimeInfo.avgSearchTime}ms/키워드 | ⏰ 완료 시간: ${this.cachedTimeInfo.completedTime} | 📊 총 소요시간: ${this.cachedTimeInfo.totalTimeStr}`;
        })()}
      </div>
    `;

    resultsDiv.innerHTML = html;
    
    // 개별보기 HTML 캐시 저장하지 않음 (클릭 카운트 반영을 위해)
    // this.cachedIndividualView 제거
    
    // 이벤트 리스너 추가
    this.addTableEventListeners();
    
    // 전역 참조 저장 (CSV 내보내기용)
    window.blogChecker = this;
    this.currentResults = allResults;
    this.currentStats = stats;
    
    // 뷰 모드 초기화 (개별보기부터 시작)
    this.currentViewMode = 'individual';
    
    document.getElementById('results').style.display = 'block';
    
    // 체크박스 상태 복원
    this.restoreCheckboxStates();
  }

  // 테이블 필터링 및 정렬 이벤트
  addTableEventListeners() {
    const filterStatus = document.getElementById('filterStatus');
    const sortBy = document.getElementById('sortBy');
    
    if (filterStatus) {
      filterStatus.addEventListener('change', () => this.filterTable());
    }
    
    if (sortBy) {
      sortBy.addEventListener('change', () => this.sortTable());
    }
    
    // 테이블 리사이즈 기능 초기화
    this.initTableResize();
    
    // 툴팁 이벤트 리스너 추가
    this.setupTooltips();
    
    // 뷰 모드 버튼 이벤트 리스너
    this.setupViewModeListeners();
  }

  // 테이블 컬럼 리사이즈 기능
  initTableResize() {
    const table = document.querySelector('.resizable-table');
    if (!table) return;

    const resizeHandles = table.querySelectorAll('.resize-handle');
    
    resizeHandles.forEach((handle, index) => {
      let isResizing = false;
      let startX = 0;
      let startWidth = 0;
      let column = null;
      
      handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        column = table.querySelectorAll('col')[index];
        startWidth = column.offsetWidth || parseFloat(column.style.width) || 100;
        
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        
        e.preventDefault();
      });
      
      document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const diffX = e.clientX - startX;
        const newWidth = Math.max(50, startWidth + diffX); // 최소 50px
        const percentage = (newWidth / table.offsetWidth) * 100;
        
        column.style.width = `${Math.min(Math.max(percentage, 5), 50)}%`; // 5%-50% 제한
      });
      
      document.addEventListener('mouseup', () => {
        if (isResizing) {
          isResizing = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      });
    });
  }

  // 툴팁 기능 설정
  setupTooltips() {
    const helpIcons = document.querySelectorAll('.help-icon');
    let currentTooltip = null;
    
    helpIcons.forEach(icon => {
      icon.addEventListener('mouseenter', (e) => {
        this.showTooltip(e.target, e.target.getAttribute('data-tooltip'));
      });
      
      icon.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });
      
      icon.addEventListener('mousemove', (e) => {
        if (currentTooltip) {
          this.updateTooltipPosition(e);
        }
      });
    });
  }

  // 툴팁 표시
  showTooltip(element, text) {
    this.hideTooltip(); // 기존 툴팁 제거
    
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    tooltip.id = 'help-tooltip';
    
    document.body.appendChild(tooltip);
    
    // 위치 설정
    const rect = element.getBoundingClientRect();
    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    tooltip.style.top = (rect.top - tooltip.offsetHeight - 10) + 'px';
    
    // 화면 경계 처리
    const tooltipRect = tooltip.getBoundingClientRect();
    if (tooltipRect.left < 5) {
      tooltip.style.left = '5px';
    } else if (tooltipRect.right > window.innerWidth - 5) {
      tooltip.style.left = (window.innerWidth - tooltipRect.width - 5) + 'px';
    }
    
    // 위쪽 공간이 부족하면 아래쪽에 표시
    if (tooltipRect.top < 5) {
      tooltip.style.top = (rect.bottom + 10) + 'px';
      tooltip.classList.add('bottom');
    }
    
    // 애니메이션으로 표시
    setTimeout(() => tooltip.classList.add('show'), 10);
  }

  // 툴팁 위치 업데이트
  updateTooltipPosition(e) {
    const tooltip = document.getElementById('help-tooltip');
    if (tooltip) {
      tooltip.style.left = (e.clientX - tooltip.offsetWidth / 2) + 'px';
      tooltip.style.top = (e.clientY - tooltip.offsetHeight - 10) + 'px';
    }
  }

  // 툴팁 숨김
  hideTooltip() {
    const tooltip = document.getElementById('help-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  // 개별 셀 선택 기능 설정 (전체 선택 기능 제거)
  setupExcelLikeSelection() {
    const table = document.querySelector('#summaryTable');
    if (!table) return;

    // 테이블 전체에서 기본 선택 방식 사용
    table.style.userSelect = 'text';
    table.style.webkitUserSelect = 'text';
    table.style.mozUserSelect = 'text';
    table.style.msUserSelect = 'text';

    // 각 셀에 기본 텍스트 선택만 가능하도록 설정
    const cells = table.querySelectorAll('td');
    cells.forEach((cell, index) => {
      cell.style.userSelect = 'text';
      cell.style.webkitUserSelect = 'text';
      cell.style.mozUserSelect = 'text';
      cell.style.msUserSelect = 'text';
      cell.style.cursor = 'text';
      
      // 셀 클릭 이벤트 제거 (기본 텍스트 선택만 가능)
      // 자동 전체 선택 기능 제거됨
    });

    // 헤더는 선택 불가능하게 설정
    const headers = table.querySelectorAll('th');
    headers.forEach(header => {
      header.style.userSelect = 'none';
      header.style.cursor = 'default';
      header.title = header.title.replace(' (클릭하면 전체 열 선택)', '');
    });

    // 우클릭 컨텍스트 메뉴 허용 (복사 기능용)
    table.addEventListener('contextmenu', (e) => {
      return true;
    });

    // 사용법 안내 업데이트
    this.addSelectionInstructions();
  }

  // 열 선택 기능 추가
  addColumnSelection(table) {
    const headers = table.querySelectorAll('th');
    headers.forEach((header, columnIndex) => {
      header.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectColumn(table, columnIndex);
      });
      
      // 헤더에 클릭 가능 표시
      header.style.cursor = 'pointer';
      header.title = header.title + ' (클릭하면 전체 열 선택)';
    });
  }

  // 전체 열 선택 함수 (독립적 선택)
  selectColumn(table, columnIndex) {
    // 기존 선택 해제
    window.getSelection().removeAllRanges();
    
    // 해당 열의 모든 셀 데이터를 추출하여 클립보드에 복사
    const rows = table.querySelectorAll('tbody tr');
    const columnData = [];
    
    // 헤더 추가
    const headers = ['블로그 URL', '노출된 키워드'];
    if (headers[columnIndex]) {
      columnData.push(headers[columnIndex]);
    }
    
    // 각 행에서 해당 열 데이터만 추출
    rows.forEach(row => {
      const cell = row.cells[columnIndex];
      if (cell) {
        const cellText = cell.textContent.trim();
        if (cellText && cellText !== '노출 없음') {
          columnData.push(cellText);
        }
      }
    });
    
    // 클립보드에 복사
    const textToCopy = columnData.join('\n');
    
    try {
      navigator.clipboard.writeText(textToCopy).then(() => {
        // 성공 메시지와 시각적 피드백
        const columnName = headers[columnIndex] || '데이터';
        alert(`📋 ${columnName} 열이 클립보드에 복사되었습니다!\n\n총 ${columnData.length - 1}개 항목`);
        this.highlightColumn(table, columnIndex);
      });
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
      // 대안: 텍스트 선택으로 폴백
      this.selectColumnFallback(table, columnIndex);
    }
  }
  
  // 클립보드 복사 실패 시 대안 방법
  selectColumnFallback(table, columnIndex) {
    const rows = table.querySelectorAll('tr');
    const range = document.createRange();
    
    let startCell = null;
    let endCell = null;
    
    rows.forEach((row, rowIndex) => {
      const cell = row.cells[columnIndex];
      if (cell) {
        if (!startCell) startCell = cell;
        endCell = cell;
      }
    });
    
    if (startCell && endCell) {
      range.setStartBefore(startCell);
      range.setEndAfter(endCell);
      window.getSelection().addRange(range);
      this.highlightColumn(table, columnIndex);
    }
  }

  // 열 하이라이트 효과
  highlightColumn(table, columnIndex) {
    // 기존 하이라이트 제거
    table.querySelectorAll('.column-highlighted').forEach(cell => {
      cell.classList.remove('column-highlighted');
    });
    
    // 해당 열 하이라이트
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cell = row.cells[columnIndex];
      if (cell) {
        cell.classList.add('column-highlighted');
      }
    });
    
    // 3초 후 하이라이트 제거
    setTimeout(() => {
      table.querySelectorAll('.column-highlighted').forEach(cell => {
        cell.classList.remove('column-highlighted');
      });
    }, 3000);
  }

  // 선택 기능 안내 추가
  addSelectionInstructions() {
    const summaryContainer = document.querySelector('#summaryTable').parentElement;
    if (!summaryContainer) return;

    const instructionsDiv = document.createElement('div');
    instructionsDiv.innerHTML = `
      <div style="margin-top: 10px; padding: 8px 12px; background: #f8f9fa; border-radius: 5px; font-size: 13px; color: #666;">
        💡 <strong>사용법:</strong> 복사를 원하는 부분을 클릭해주세요! | 📋상단 버튼을 눌러 전체 키워드 복사도 가능해요!
      </div>
    `;
    summaryContainer.appendChild(instructionsDiv);
  }

  // 뷰 모드 버튼 이벤트 설정
  setupViewModeListeners() {
    const individualBtn = document.getElementById('viewModeIndividual');
    const summaryBtn = document.getElementById('viewModeSummary');
    
    if (individualBtn) {
      individualBtn.addEventListener('click', () => this.switchViewMode('individual'));
    }
    
    if (summaryBtn) {
      summaryBtn.addEventListener('click', () => this.switchViewMode('summary'));
    }
  }

  // 뷰 모드 전환
  switchViewMode(mode) {
    this.currentViewMode = mode;
    
    // 버튼 활성화 상태 업데이트
    const individualBtn = document.getElementById('viewModeIndividual');
    const summaryBtn = document.getElementById('viewModeSummary');
    
    if (mode === 'individual') {
      individualBtn.style.background = '#28a745';
      summaryBtn.style.background = '#6c757d';
      individualBtn.classList.add('active');
      summaryBtn.classList.remove('active');
      

      
      // 개별보기 표시
      this.showIndividualView();
    } else {
      individualBtn.style.background = '#6c757d';
      summaryBtn.style.background = '#28a745';
      individualBtn.classList.remove('active');
      summaryBtn.classList.add('active');
      

      
      // 전체보기 표시
      this.showSummaryView();
    }
  }

  // 개별보기 (기존 테이블)
  showIndividualView() {
    const container = document.querySelector('.results-table-container');
    if (!container) return;
    
    // 기존 테이블 표시 (sortBy 옵션도 원래대로)
    const sortBy = document.getElementById('sortBy');
    if (sortBy) {
      sortBy.innerHTML = `
        <option value="recommended" selected>추천순 (기본)</option>
        <option value="keyword">키워드순</option>
        <option value="rank">순위순</option>
        <option value="blog">블로그순</option>
      `;
    }
    
    // 항상 displayTableResults를 호출하여 현재 클릭 카운트를 반영
    if (this.currentResults && this.currentStats) {
      this.displayTableResults(this.currentResults, this.currentStats);
      // 체크박스 상태 복원
      this.restoreCheckboxStates();
    }
  }


  // 전체보기 (블로그별 요약)
  showSummaryView() {
    const container = document.querySelector('.results-table-container');
    if (!container) return;
    
    // sortBy 옵션 변경
    const sortBy = document.getElementById('sortBy');
    if (sortBy) {
      sortBy.innerHTML = `
        <option value="inputOrder" selected>사용자입력순</option>
        <option value="exposureCount">노출개수순</option>
        <option value="blogName">블로그이름순</option>
      `;
    }
    
    // 전체보기 테이블 생성
    this.createSummaryTable();
  }

  // 전체보기 테이블 생성
  createSummaryTable() {
    if (!this.currentResults) return;
    
    // 블로그별로 데이터 그룹화
    const blogData = this.groupResultsByBlog(this.currentResults);
    
    const container = document.querySelector('.results-table-container');
    container.innerHTML = `
      <table id="summaryTable" class="results-table resizable-table" style="width: 100%; border-collapse: collapse; font-size: 0.9em; table-layout: fixed;">
        <colgroup>
          <col style="width: 40%;">
          <col style="width: 60%;">
        </colgroup>
        <thead style="background: #f8f9fa; position: sticky; top: 0; z-index: 10;">
          <tr>
            <th style="padding: 12px; border-bottom: 2px solid #ddd; text-align: left; border-right: 1px solid #dee2e6; width: 40%;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span>블로그 URL (클릭 복사)
                  <span title="클릭하면 해당 URL이 클립보드에 복사됩니다." style="margin-left: 4px; cursor: help; color: #666; font-size: 12px; font-weight: normal;">ⓘ</span>
                </span>
                <button onclick="window.blogChecker.copyAllUrls()" style="padding: 4px 8px; background: #17a2b8; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.75em;">📋 전체 URL 복사</button>
              </div>
            </th>
            <th style="padding: 12px; border-bottom: 2px solid #ddd; text-align: left; width: 60%;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span>노출된 키워드 (클릭 복사)
                  <span title="클릭하면 해당 키워드들이 클립보드에 복사됩니다." style="margin-left: 4px; cursor: help; color: #666; font-size: 12px; font-weight: normal;">ⓘ</span>
                </span>
                <button onclick="window.blogChecker.copyAllKeywords()" style="padding: 4px 8px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.75em;">📋 전체 키워드 복사</button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody id="summaryTableBody">
          ${this.generateSummaryRows(blogData)}
        </tbody>
      </table>
    `;
    
    // 툴팁 재설정 (title 속성으로 자동 처리됨)
    // this.setupTooltips(); // 더 이상 필요 없음
    
    // 엑셀 스타일 테이블 선택 기능 설정
    this.setupExcelLikeSelection();
  }

  // 블로그별 데이터 그룹화
  groupResultsByBlog(results) {
    const blogMap = new Map();
    const blogUrls = document.getElementById('blogUrls').value.trim().split('\n').map(u => u.trim()).filter(u => u);
    
    // 먼저 사용자가 입력한 모든 블로그 URL을 초기화 (순서 보장)
    blogUrls.forEach((inputUrl, idx) => {
      const normalizedUrl = this.normalizeUrl(inputUrl);
      blogMap.set(normalizedUrl, {
        blogUrl: inputUrl, // 원본 입력 URL 사용
        keywords: [],
        inputOrder: idx, // 실제 입력 순서
        totalExposures: 0
      });
    });
    
    // 그 다음 검색 결과를 각 블로그에 매핑 (숨겨진 항목 제외)
    results.forEach((result) => {
      const resultUrl = result.url || result.blogUrl || '';
      if (!resultUrl) return;
      
      // 개별 항목이 숨겨졌는지 확인
      const itemKey = `${result.keyword}|||${resultUrl}`;
      if (this.hiddenItems && this.hiddenItems.has(itemKey)) {
        return;
      }
      
      const normalizedResultUrl = this.normalizeUrl(resultUrl);
      
      // 매칭되는 블로그 찾기
      if (blogMap.has(normalizedResultUrl)) {
        const blogData = blogMap.get(normalizedResultUrl);
        
        // 실제 숫자 순위가 있는 경우만 키워드 추가
        const hasRealRank = result.rank && result.rank.found && result.rank.position && result.rank.position >= 1;
        
        if (hasRealRank) {
          blogData.keywords.push({
            keyword: result.keyword,
            rank: result.rank.position,
            status: result.status
          });
          blogData.totalExposures++;
        }
      }
    });
    
    // 입력 순서대로 정렬된 배열 반환
    return Array.from(blogMap.values()).sort((a, b) => a.inputOrder - b.inputOrder);
  }

  // 전체보기 테이블 행 생성 (클릭 복사 기능)
  generateSummaryRows(blogData) {
    return blogData.map((blog, index) => {
      // 키워드+(순위) 형태로 순수 텍스트만 생성, 콤마로 구분
      const keywordList = blog.keywords.map(kw => `${kw.keyword}(${kw.rank}위)`).join(', ');
      const keywordCount = blog.keywords.length;
      const keywordDisplay = keywordCount > 0 ? keywordList : '-';
      
      return `
        <tr class="summary-row excel-selectable" data-blog-url="${blog.blogUrl}" data-input-order="${blog.inputOrder}" data-exposure-count="${keywordCount}" data-blog-name="${this.extractBlogName(blog.blogUrl)}">
          <td class="excel-cell clickable-cell" 
              onclick="window.blogChecker.copyText('${blog.blogUrl.replace(/'/g, "\\'")}', 'URL')"
              style="padding: 8px 10px; border: 1px solid #ddd; word-break: break-all; cursor: pointer; background: white; transition: background 0.2s;"
              onmouseover="this.style.background='#f0f8ff'"
              onmouseout="this.style.background='white'"
              title="클릭하여 URL 복사">
            ${blog.blogUrl}
          </td>
          <td class="excel-cell clickable-cell" 
              onclick="window.blogChecker.copyText('${keywordDisplay.replace(/'/g, "\\'")}', '키워드')"
              style="padding: 8px 10px; border: 1px solid #ddd; word-wrap: break-word; white-space: normal; line-height: 1.4; cursor: pointer; background: white; transition: background 0.2s; max-width: 400px;"
              onmouseover="this.style.background='#f0f8ff'"
              onmouseout="this.style.background='white'"
              title="클릭하여 키워드 복사">
            ${keywordDisplay}
          </td>
        </tr>
      `;
    }).join('');
  }

  // 블로그 이름 추출 (URL에서)
  extractBlogName(url) {
    try {
      if (url.includes('blog.naver.com/')) {
        const match = url.match(/blog\.naver\.com\/([^\/]+)/);
        return match ? match[1] : url;
      }
      if (url.includes('in.naver.com/')) {
        const match = url.match(/in\.naver\.com\/([^\/]+)/);
        return match ? `@${match[1]}` : url; // 인플루언서는 @표시로 구분
      }
      return new URL(url).hostname;
    } catch (error) {
      return url;
    }
  }

  // 테이블 필터링
  filterTable() {
    const filterValue = document.getElementById('filterStatus').value;
    const rows = document.querySelectorAll('.result-row, .summary-row');
    
    rows.forEach(row => {
      const status = row.getAttribute('data-status');
      if (filterValue === 'all' || status === filterValue) {
        row.style.display = '';
    } else {
        row.style.display = 'none';
      }
    });
  }

  // 테이블 정렬
  sortTable() {
    const sortValue = document.getElementById('sortBy').value;
    
    if (this.currentViewMode === 'summary') {
      this.sortSummaryTable(sortValue);
      return;
    }
    
    const tbody = document.getElementById('resultsTableBody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('.result-row'));
    
    // 추천순 초기화: data-original-index 설정
    if (sortValue === 'recommended') {
      rows.forEach((row, index) => {
        if (!row.hasAttribute('data-original-index')) {
          row.setAttribute('data-original-index', index);
        }
      });
    }
    
    rows.sort((a, b) => {
      if (sortValue === 'recommended') {
        // 추천순 정렬: 순위값 1이라도 존재하는 항목만 키워드순으로 정렬
        const aRankText = a.cells[2].textContent.trim();
        const bRankText = b.cells[2].textContent.trim();
        
        // 실제 숫자 순위가 있는지 정확히 판별
        const aHasRank = aRankText !== '-' && aRankText !== '순위권밖' && aRankText !== '검색실패' && !isNaN(parseInt(aRankText));
        const bHasRank = bRankText !== '-' && bRankText !== '순위권밖' && bRankText !== '검색실패' && !isNaN(parseInt(bRankText));
        

        
        // 1순위: 순위 발견 여부 (실제 순위 있는 것들만 위로)
        if (aHasRank && !bHasRank) return -1;
        if (!aHasRank && bHasRank) return 1;
        
        // 2순위: 둘 다 순위가 있는 경우 - 키워드순으로만 정렬
        if (aHasRank && bHasRank) {
          return a.getAttribute('data-keyword').localeCompare(b.getAttribute('data-keyword'));
        }
        
        // 3순위: 둘 다 순위가 없는 경우 - 원본 입력 순서 유지
        if (!aHasRank && !bHasRank) {
          const aOriginal = parseInt(a.getAttribute('data-original-index') || '0');
          const bOriginal = parseInt(b.getAttribute('data-original-index') || '0');
          return aOriginal - bOriginal;
        }
        
        return 0;
      } else if (sortValue === 'keyword') {
        // 단순 키워드순 정렬
        return a.getAttribute('data-keyword').localeCompare(b.getAttribute('data-keyword'));
      } else if (sortValue === 'rank') {
        // 단순 순위순 정렬
        const aRank = parseInt(a.cells[2].textContent) || 999;
        const bRank = parseInt(b.cells[2].textContent) || 999;
        return aRank - bRank;
      } else if (sortValue === 'blog') {
        // 단순 블로그순 정렬
        return a.getAttribute('data-blog').localeCompare(b.getAttribute('data-blog'));
      }
    });
    
    rows.forEach(row => tbody.appendChild(row));
    
    // 체크박스 상태 복원
    this.restoreCheckboxStates();
  }

  // 전체보기 테이블 정렬
  sortSummaryTable(sortValue) {
    const tbody = document.getElementById('summaryTableBody');
    if (!tbody) return;
    
    const rows = Array.from(tbody.querySelectorAll('.summary-row'));
    
    rows.sort((a, b) => {
      switch (sortValue) {
        case 'inputOrder':
          // 사용자 입력 순서 (노출 없음도 입력 순서 그대로 유지)
          const aOrder = parseInt(a.getAttribute('data-input-order') || '999');
          const bOrder = parseInt(b.getAttribute('data-input-order') || '999');
          return aOrder - bOrder;
          
        case 'exposureCount':
          // 노출 개수순 (많은 순, 노출 없음은 아래로)
          const aCount = parseInt(a.getAttribute('data-exposure-count') || '0');
          const bCount = parseInt(b.getAttribute('data-exposure-count') || '0');
          
          // 노출 없음(0개)을 아래로 보내기
          if (aCount === 0 && bCount > 0) return 1;
          if (aCount > 0 && bCount === 0) return -1;
          
          return bCount - aCount; // 내림차순
          
        case 'blogName':
          // 블로그 이름순 (노출 없음은 아래로)
          const aCount2 = parseInt(a.getAttribute('data-exposure-count') || '0');
          const bCount2 = parseInt(b.getAttribute('data-exposure-count') || '0');
          
          // 노출 없음(0개)을 아래로 보내기
          if (aCount2 === 0 && bCount2 > 0) return 1;
          if (aCount2 > 0 && bCount2 === 0) return -1;
          
          // 같은 노출 상태라면 블로그 이름순
          const aName = a.getAttribute('data-blog-name') || '';
          const bName = b.getAttribute('data-blog-name') || '';
          return aName.localeCompare(bName);
          
        default:
          return 0;
      }
    });
    
    // 정렬된 순서로 DOM 재배치
    rows.forEach(row => row.remove());
    rows.forEach(row => tbody.appendChild(row));
  }

  // XLSX 내보내기 (한글 깨짐 해결) - 개별보기 + 전체보기 시트 포함
  async exportResults() {
    if (!this.currentResults) return;
    
    try {
      // ExcelJS 워크북 생성
      const workbook = new ExcelJS.Workbook();
      
      // 개별보기 시트 생성
      const individualSheet = workbook.addWorksheet('개별보기');
      
      // 개별보기 헤더 설정
      individualSheet.columns = [
        { header: '키워드', key: 'keyword', width: 20 },
        { header: '블로그 URL', key: 'blogUrl', width: 40 },
        { header: '순위', key: 'rank', width: 10 },
        { header: '총 결과수', key: 'totalResults', width: 12 },
        { header: '상태', key: 'status', width: 15 },
        { header: '수정여부', key: 'isEdited', width: 10 }
      ];
      
      // 개별보기 데이터 추가
      this.currentResults.forEach(result => {
        let status;
        if (result.rank.found) {
          const rank = result.rank.position;
          if (rank <= 3) status = '상위권노출';
          else if (rank <= 6) status = '하위권노출';
          else status = '확인필요';
        } else if (result.rank.error) {
          status = '검색실패';
        } else {
          status = '순위권밖';
        }
        
        individualSheet.addRow({
          keyword: result.keyword,
          blogUrl: result.blogUrl,
          rank: result.rank.found ? result.rank.position : '-',
          totalResults: result.totalBlogsInKeyword || '-',
          status: status,
          isEdited: result.isManuallyEdited ? '수정됨' : ''
        });
      });
      
      // 전체보기 시트 생성
      const summarySheet = workbook.addWorksheet('전체보기');
      
      // 전체보기 헤더 설정
      summarySheet.columns = [
        { header: '블로그 URL', key: 'blogUrl', width: 40 },
        { header: '노출된 키워드', key: 'exposedKeywords', width: 60 },
        { header: '노출 개수', key: 'exposureCount', width: 12 }
      ];
      
      // 전체보기 데이터 생성 및 추가
      const blogData = this.groupResultsByBlog(this.currentResults);
      blogData.forEach(blog => {
        const keywordList = blog.keywords.map(kw => `${kw.keyword}(${kw.rank}위)`).join(', ');
        
        summarySheet.addRow({
          blogUrl: blog.blogUrl,
          exposedKeywords: keywordList || '노출 없음',
          exposureCount: blog.totalExposures
        });
      });
      
      // 개별보기 헤더 스타일 적용
      individualSheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      });
      
      // 전체보기 헤더 스타일 적용
      summarySheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F8FF' } };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      });
      
      // 개별보기 상태별 색상 적용
      individualSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) { // 헤더 제외
          const statusCell = row.getCell(5);
          const status = statusCell.value;
          
          if (status === '상위권노출') {
            statusCell.font = { color: { argb: 'FF28a745' }, bold: true };
          } else if (status === '하위권노출') {
            statusCell.font = { color: { argb: 'FFf39c12' }, bold: true };
          } else if (status === '확인필요') {
            statusCell.font = { color: { argb: 'FFdc3545' }, bold: true };
          }
        }
      });
      
      // 전체보기 노출 개수별 색상 적용
      summarySheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) { // 헤더 제외
          const exposureCell = row.getCell(3);
          const exposureCount = exposureCell.value;
          
          if (exposureCount >= 3) {
            exposureCell.font = { color: { argb: 'FF28a745' }, bold: true };
          } else if (exposureCount >= 1) {
            exposureCell.font = { color: { argb: 'FFf39c12' }, bold: true };
          }
        }
      });
      
      // 파일 생성 및 다운로드
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `블로그순위결과_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      
      console.log('✅ 엑셀 파일이 다운로드되었습니다 (개별보기 + 전체보기 시트 포함)');
      
    } catch (error) {
      console.error('XLSX 내보내기 오류:', error);
      alert('파일 내보내기 중 오류가 발생했습니다.');
    }
  }

  showError(message) {
    const resultsDiv = document.getElementById('resultsList');
    const currentTime = new Date().toLocaleTimeString('ko-KR');
    
    let errorHtml = `<div class="error-message">
      <h4>❌ 오류 발생 (${currentTime})</h4>
      <p>${message}</p>
    `;
    
    // 프록시 에러인 경우 해결책 제시
    if (message.includes('프록시 서버')) {
      errorHtml += `
        <div style="margin-top: 15px; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px;">
          <h5>🛠️ 해결 방법:</h5>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>1~2분 후 다시 시도해보세요</li>
            <li>다른 네트워크(모바일 핫스팟 등)에서 시도해보세요</li>
            <li>브라우저를 새로고침하고 다시 시도해보세요</li>
            <li>VPN을 사용 중이라면 끄고 시도해보세요</li>
          </ul>
        </div>
      `;
    }
    
    errorHtml += `</div>`;
    resultsDiv.innerHTML = errorHtml;
    document.getElementById('results').style.display = 'block';
  }

  // 열별 복사 기능 (전체 열)
  copyColumn(columnType) {
    const tbody = document.getElementById('summaryTableBody');
    if (!tbody) {
      alert('전체보기 테이블을 찾을 수 없습니다.');
      return;
    }

    const rows = tbody.querySelectorAll('.summary-row');
    let data = [];

    rows.forEach(row => {
      if (columnType === 'blogUrl') {
        // 블로그 URL 열 (첫 번째 셀에서 직접 텍스트 추출)
        const urlCell = row.querySelector('td:first-child');
        if (urlCell) {
          const urlText = urlCell.textContent.trim();
          if (urlText && urlText !== '노출 없음') {
            data.push(urlText);
          }
        }
      } else if (columnType === 'keywords') {
        // 키워드 열 (두 번째 셀)
        const keywordCell = row.querySelector('td:nth-child(2)');
        if (keywordCell) {
          const keywordText = keywordCell.textContent.trim();
          if (keywordText && keywordText !== '노출 없음') {
            data.push(keywordText);
          }
        }
      }
    });

    if (data.length === 0) {
      alert('복사할 데이터가 없습니다.');
      return;
    }

    // 클립보드에 복사
    const textToCopy = data.join('\n');
    
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        const columnName = columnType === 'blogUrl' ? 'URL' : '키워드';
        alert(`✅ ${columnName} ${data.length}개가 클립보드에 복사되었습니다!`);
      }).catch(err => {
        console.error('클립보드 복사 실패:', err);
        this.fallbackCopyToClipboard(textToCopy, columnType);
      });
    } else {
      this.fallbackCopyToClipboard(textToCopy, columnType);
    }
  }

  // 개별 행 복사 기능
  copyRowData(rowElement, dataType) {
    let textToCopy = '';
    
    if (dataType === 'url') {
      const urlCell = rowElement.querySelector('td:first-child');
      textToCopy = urlCell ? urlCell.textContent.trim() : '';
    } else if (dataType === 'keywords') {
      const keywordCell = rowElement.querySelector('td:nth-child(2)');
      textToCopy = keywordCell ? keywordCell.textContent.trim() : '';
    }

    if (!textToCopy || textToCopy === '노출 없음') {
      alert('복사할 데이터가 없습니다.');
      return;
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        const dataName = dataType === 'url' ? 'URL' : '키워드';
        alert(`✅ ${dataName}이 클립보드에 복사되었습니다!`);
      }).catch(err => {
        console.error('클립보드 복사 실패:', err);
        this.fallbackCopyToClipboard(textToCopy, dataType);
      });
    } else {
      this.fallbackCopyToClipboard(textToCopy, dataType);
    }
  }





  // 클립보드 복사 대체 방법
  fallbackCopyToClipboard(text, columnType) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      const columnName = columnType === 'blogUrl' ? 'URL' : '키워드';
      const lines = text.split('\n').length;
      alert(`✅ ${columnName} ${lines}개가 클립보드에 복사되었습니다!`);
    } catch (err) {
      alert('❌ 클립보드 복사에 실패했습니다. 수동으로 복사해주세요.');
      console.error('Fallback copy failed:', err);
    }
    
    document.body.removeChild(textArea);
  }

  async checkRanks() {
    try {
      // 클릭 카운트 초기화 (새로운 검색 시작 시)
      this.previewClickCounts = new Map();
      
      // 선택된 서버 확인
      if (this.selectedServers.size === 0) {
        alert('⚠️ 프록시 서버를 선택해주세요. "서버 상태 새로고침" 버튼을 클릭하여 사용 가능한 서버를 확인하세요.');
        return;
      }
      
      // 검색 시작 상태로 변경
      this.setSearchButtonState(true);
      this.searchAbortController = new AbortController();
      this.lastProgress = 0; // 진행률 초기화
      
      this.showLoading();
      this.startTime = Date.now(); // 시작 시간 설정
      
      // 새로운 검색 시작 시 캐시 초기화
      this.cachedTimeInfo = null;
      this.cachedIndividualView = null;
      
      const { keywords, blogUrls } = this.validateInputs();
      const batchSize = this.selectedServers.size; // 선택된 서버 수를 배치 크기로 사용
      
      console.log('🔍 대량 검색 시작 (자동 병렬 처리):', { 
        keywords: keywords.length, 
        blogUrls: blogUrls.length,
        batchSize,
        startTime: new Date().toLocaleTimeString('ko-KR')
      });

      this.updateProgress(0, keywords.length, '검색 준비 중...');
      
      // 항상 병렬 배치 처리 (성능 최적화)
      const startTime = Date.now();
      const searchResults = await this.processBatch(keywords, batchSize);
      
      const searchTime = Date.now() - startTime;
      console.log(`⏱️ 검색 완료: ${searchTime}ms`);
      
      // 순위 분석
      const analysisProxyInfo = this.lastUsedProxy ? `사용된 프록시: ${this.lastUsedProxy}` : '';
      this.updateProgress(keywords.length, keywords.length, '순위 분석 중...', analysisProxyInfo);
      const allResults = [];
      let totalBlogsFound = 0;
      const failedKeywords = []; // 실패한 키워드 추적
      
      searchResults.forEach(({ keyword, blogLinks, error }) => {
        if (error) {
          failedKeywords.push(keyword); // 실패한 키워드 저장
        }
        totalBlogsFound += blogLinks.length;
        
        blogUrls.forEach(blogUrl => {
          if (error) {
            allResults.push({
              keyword,
              blogUrl,
              rank: { found: false, position: null, error },
              totalBlogsInKeyword: 0
            });
          } else {
            const rank = this.findRank(blogUrl, blogLinks);
            allResults.push({
              keyword,
              blogUrl,
              rank,
              totalBlogsInKeyword: blogLinks.length
            });
          }
        });
      });

      // 통계 정보
      const stats = {
        totalKeywords: keywords.length,
        totalBlogUrls: blogUrls.length,
        totalBlogsFound,
        foundCount: allResults.filter(r => r.rank.found).length,
        searchTime,
        cacheHits: keywords.filter(k => this.searchCache.has(k)).length,
        workingProxies: this.workingProxies ? this.workingProxies.size : 0,
        totalProxies: this.selectedServers.size,
        failedKeywords: failedKeywords // 실패한 키워드 목록 추가
      };

      this.displayTableResults(allResults, stats);
      
  } catch (error) {
      if (error.name === 'AbortError') {
        console.log('🚫 검색이 취소되었습니다');
        return; // 취소된 경우 에러 표시하지 않음
      }
      console.error('❌ 오류 발생:', error);
      this.showError(error.message);
    } finally {
      this.hideLoading();
      this.setSearchButtonState(false); // 검색 완료 시 버튼 상태 복원
      this.searchAbortController = null;
    }
  }

  // 팝업 모달 내부에 네이버 페이지 표시 (프록시 사용)
  async showPreview(blogUrl, keyword) {
    try {
      // 클릭 횟수 추적을 위한 Map 초기화 (없으면 생성)
      if (!this.previewClickCounts) {
        this.previewClickCounts = new Map();
      }
      
      // 현재 버튼의 고유 키 생성 (blogUrl + keyword 조합)
      const buttonKey = `${blogUrl}_${keyword}`;
      
      // 현재 클릭 횟수 가져오기 (순위 노출 안된 항목은 이미 1로 설정되어 있을 수 있음)
      const currentCount = this.previewClickCounts.get(buttonKey) || 0;
      
      // 클릭 횟수 증가 (이미 1이면 2로, 0이면 1로)
      const newCount = Math.min(currentCount + 1, 2); // 최대 2번까지만 카운트
      this.previewClickCounts.set(buttonKey, newCount);
      
      // 모든 preview 버튼 찾기
      const allButtons = document.querySelectorAll('.preview-btn');
      allButtons.forEach(btn => {
        // onclick 속성에서 현재 버튼인지 확인 (정확한 매칭)
        const onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr) {
          // 정규식을 사용하여 정확한 파라미터 추출
          const match = onclickAttr.match(/showPreview\('([^']*)',\s*'([^']*)'\)/);
          if (match) {
            const btnBlogUrl = match[1].replace(/\\'/g, "'");
            const btnKeyword = match[2].replace(/\\'/g, "'");
            
            // 정확히 일치하는지 확인
            if (btnBlogUrl === blogUrl && btnKeyword === keyword) {
              // 기존 클래스 제거
              btn.classList.remove('clicked-once', 'clicked-twice');
              
              // 클릭 횟수에 따라 클래스 추가
              if (newCount === 1) {
                btn.classList.add('clicked-once');
              } else if (newCount === 2) {
                btn.classList.add('clicked-twice');
              }
            }
          }
        }
      });
      
      // 현재 스크롤 위치 저장 (이벤트 전파 방지)
      const currentScrollPos = window.pageYOffset || document.documentElement.scrollTop;
      this.savedScrollPosition = currentScrollPos;
      
      // 현재 미리보기 정보 저장
      this.currentPreviewBlogUrl = blogUrl;
      this.currentPreviewKeyword = keyword;
      
      // 네이버 블로그 검색 URL 생성
      const searchQuery = encodeURIComponent(keyword);
      const naverSearchUrl = `https://search.naver.com/search.naver?where=blog&query=${searchQuery}`;
      
      // 선택된 프록시 서버를 통해 네이버 페이지 가져오기
      const selectedServers = Array.from(this.selectedServers);
      if (selectedServers.length === 0) {
        alert('프록시 서버를 먼저 선택해주세요.');
        return;
      }
      
      // 프록시 URL 생성
      const proxyUrl = selectedServers[0];
      const proxiedSearchUrl = `${proxyUrl}${encodeURIComponent(naverSearchUrl)}`;
      
      // 팝업 모달 생성 (프록시를 통한 iframe 사용)
      this.createProxiedPreviewModal(proxiedSearchUrl, naverSearchUrl, blogUrl, keyword);
      
      // 스크롤 위치 유지
      setTimeout(() => {
        window.scrollTo(0, currentScrollPos);
      }, 0);
      
    } catch (error) {
      console.error('미리보기 열기 실패:', error);
      alert(`미리보기를 열 수 없습니다:\n${error.message}`);
    }
  }

  // 팝업 + 오버레이 가이드 생성
  createPopupWithOverlay(searchUrl, blogUrl, keyword) {
    // 새 창에서 네이버 블로그 검색 페이지 열기
    const popup = window.open(searchUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    
    if (!popup) {
      alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.');
      return;
    }

    // 메인 사이트에 오버레이 가이드 생성
    this.createOverlayGuide(blogUrl, keyword, popup);
  }

  // 오버레이 가이드 생성
  createOverlayGuide(blogUrl, keyword, popup) {
    // 기존 오버레이가 있으면 제거
    const existingOverlay = document.querySelector('.popup-overlay-guide');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    const normalizedBlogUrl = this.normalizeUrl(blogUrl);
    const targetBlogId = this.extractBlogId(normalizedBlogUrl);
    
    // 오버레이 가이드 생성
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay-guide';
    overlay.innerHTML = `
      <div class="overlay-content">
        <div class="overlay-header">
          <h3>🎯 블로그 찾기 가이드</h3>
          <button class="close-overlay-btn" onclick="this.closest('.popup-overlay-guide').remove()">✕</button>
        </div>
        <div class="overlay-body">
          <div class="search-info">
            <h4>🔍 검색 키워드: "${keyword}"</h4>
            <p><strong>대상 블로그 ID:</strong> <code>${targetBlogId}</code></p>
          </div>
          
          <div class="guide-steps">
            <h4>📋 찾는 방법:</h4>
            <ol>
              <li><strong>Ctrl+F</strong>를 눌러 검색창을 여세요</li>
              <li><code>${targetBlogId}</code>를 입력하여 검색하세요</li>
              <li>또는 다음 형태의 링크를 찾아보세요:</li>
              <li style="margin-left: 20px;">• <code>blog.naver.com/${targetBlogId}</code></li>
              <li style="margin-left: 20px;">• <code>m.blog.naver.com/${targetBlogId}</code></li>
              <li style="margin-left: 20px;">• <code>PostView.naver?blogId=${targetBlogId}</code></li>
              <li>해당 블로그가 <span style="background: #ffeb3b; padding: 2px 4px; border-radius: 3px;">노란색으로 하이라이트</span>됩니다</li>
            </ol>
          </div>
          
          <div class="popup-controls">
            <button class="focus-popup-btn" onclick="window.blogRankChecker.focusPopup()">
              🎯 팝업창 포커스
            </button>
            <button class="close-popup-btn" onclick="window.blogRankChecker.closePopupAndOverlay()">
              ❌ 팝업 닫기
            </button>
          </div>
        </div>
      </div>
    `;

    // 스타일 적용
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
    `;

    document.body.appendChild(overlay);
    
    // 팝업 참조 저장
    this.currentPopup = popup;
    
    // 팝업이 닫히면 오버레이도 제거
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        overlay.remove();
        clearInterval(checkClosed);
        this.currentPopup = null;
      }
    }, 1000);
  }

  // 팝업 포커스
  focusPopup() {
    if (this.currentPopup && !this.currentPopup.closed) {
      this.currentPopup.focus();
    } else {
      alert('팝업창이 닫혔습니다.');
    }
  }

  // 팝업과 오버레이 모두 닫기
  closePopupAndOverlay() {
    if (this.currentPopup && !this.currentPopup.closed) {
      this.currentPopup.close();
    }
    const overlay = document.querySelector('.popup-overlay-guide');
    if (overlay) {
      overlay.remove();
    }
    this.currentPopup = null;
  }

  // 실패한 키워드 재시도 또는 전체 재검색
  async retryFailedKeywords() {
    // 실패한 키워드가 있는 경우
    if (this.currentStats && this.currentStats.failedKeywords && this.currentStats.failedKeywords.length > 0) {
      const failedKeywords = this.currentStats.failedKeywords;
      const confirmMessage = `실패한 ${failedKeywords.length}개 키워드를 재시도하시겠습니까?\n\n키워드: ${failedKeywords.join(', ')}`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
      
      try {
        // 검색 시작 상태로 변경
        this.setSearchButtonState(true);
        this.searchAbortController = new AbortController();
        this.showLoading();
        
        const blogUrls = document.getElementById('blogUrls').value.trim().split('\n').map(u => u.trim()).filter(u => u);
        const batchSize = this.selectedServers.size;
        
        console.log('🔄 실패한 키워드 재시도:', failedKeywords);
        
        // 실패한 키워드만 다시 검색
        const searchResults = await this.processBatch(failedKeywords, batchSize);
        
        // 기존 결과에서 실패한 키워드 결과 제거
        const existingResults = this.currentResults.filter(r => !failedKeywords.includes(r.keyword));
        
        // 새로운 결과 추가
        const newResults = [];
        searchResults.forEach(({ keyword, blogLinks, error }) => {
          blogUrls.forEach(blogUrl => {
            if (error) {
              newResults.push({
                keyword,
                blogUrl,
                rank: { found: false, position: null, error },
                totalBlogsInKeyword: 0
              });
            } else {
              const rank = this.findRank(blogUrl, blogLinks);
              newResults.push({
                keyword,
                blogUrl,
                rank,
                totalBlogsInKeyword: blogLinks.length
              });
            }
          });
        });
        
        // 전체 결과 합치기
        const allResults = [...existingResults, ...newResults];
        
        // 통계 업데이트
        const newFailedKeywords = searchResults.filter(r => r.error).map(r => r.keyword);
        const stats = {
          ...this.currentStats,
          failedKeywords: newFailedKeywords,
          foundCount: allResults.filter(r => r.rank.found).length
        };
        
        // 결과 다시 표시
        this.displayTableResults(allResults, stats);
        
        if (newFailedKeywords.length === 0) {
          this.showToast('모든 키워드 재시도 성공!', 'success');
        } else {
          this.showToast(`${failedKeywords.length - newFailedKeywords.length}개 성공, ${newFailedKeywords.length}개 여전히 실패`, 'warning');
        }
        
      } catch (error) {
        console.error('재시도 중 오류:', error);
        this.showError(error.message);
      } finally {
        this.hideLoading();
        this.setSearchButtonState(false);
        this.searchAbortController = null;
      }
    } 
    // 실패한 키워드가 없는 경우 - 전체 재검색
    else {
      const confirmMessage = '전체 키워드를 다시 검색하시겠습니까?\n\n캐시가 초기화되고 모든 키워드를 새로 검색합니다.';
      
      if (!confirm(confirmMessage)) {
        return;
      }
      
      // 캐시 초기화
      this.searchCache.clear();
      console.log('🔄 캐시 초기화 및 전체 재검색');
      
      // 검색 버튼 클릭과 동일한 동작
      await this.checkRanks();
    }
  }

  // 체크박스 상태 복원
  restoreCheckboxStates() {
    if (!this.hiddenItems) return;
    
    const checkboxes = document.querySelectorAll('.keyword-hide-checkbox');
    checkboxes.forEach(checkbox => {
      const keyword = checkbox.getAttribute('data-keyword');
      const blog = checkbox.getAttribute('data-blog');
      const itemKey = `${keyword}|||${blog}`;
      
      if (this.hiddenItems.has(itemKey)) {
        checkbox.checked = true;
      }
    });
  }
  
  // 순위 편집 시작
  onRankEditStart(element) {
    // 편집 시작 시 배경색 변경
    element.style.background = '#f0f8ff';
    element.style.outline = '2px solid #667eea';
    
    // 현재 값 저장
    this.originalRankValue = element.textContent.trim();
    
    // '-' 인 경우 선택을 위해 전체 선택
    if (element.textContent.trim() === '-') {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
  
  // 순위 편집 종료
  onRankEditEnd(element) {
    // 배경색 원래대로
    element.style.background = '';
    element.style.outline = '';
    
    const newValue = element.textContent.trim();
    const keyword = element.getAttribute('data-keyword');
    const blogUrl = element.getAttribute('data-blog');
    
    // 유효성 검사
    if (newValue !== '-' && newValue !== '') {
      const rankNum = parseInt(newValue);
      if (isNaN(rankNum) || rankNum < 1 || rankNum > 100) {
        // 잘못된 값이면 원래 값으로 복원
        element.textContent = this.originalRankValue;
        this.showToast('순위는 1-100 사이의 숫자 또는 "-"만 입력 가능합니다.', 'error');
        return;
      }
      element.textContent = rankNum;
    } else {
      element.textContent = '-';
    }
    
    // 수정된 값 저장
    this.updateRankData(keyword, blogUrl, element.textContent.trim());
    
    // 상태 및 색상 업데이트
    this.updateRankDisplay(element);
  }
  
  // 순위 입력 시 키 처리
  onRankKeydown(event, element) {
    // Enter 키로 편집 완료
    if (event.key === 'Enter') {
      event.preventDefault();
      element.blur();
      return;
    }
    
    // ESC 키로 편집 취소
    if (event.key === 'Escape') {
      event.preventDefault();
      element.textContent = this.originalRankValue;
      element.blur();
      return;
    }
    
    // 숫자, 백스페이스, Delete, 화살표 키, - 만 허용
    const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', '-'];
    if (!allowedKeys.includes(event.key) && !/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }
  
  // 순위 데이터 업데이트
  updateRankData(keyword, blogUrl, newRank) {
    // currentResults에서 해당 항목 찾아서 업데이트
    if (this.currentResults) {
      const result = this.currentResults.find(r => 
        r.keyword === keyword && r.blogUrl === blogUrl
      );
      
      if (result) {
        if (newRank === '-') {
          result.rank.found = false;
          result.rank.position = null;
          result.isManuallyEdited = true;
        } else {
          result.rank.found = true;
          result.rank.position = parseInt(newRank);
          result.isManuallyEdited = true;
        }
        
        console.log(`✏️ 순위 수정: ${keyword} / ${blogUrl} → ${newRank}`);
      }
    }
  }
  
  // 순위 표시 업데이트
  updateRankDisplay(element) {
    const newValue = element.textContent.trim();
    const row = element.closest('tr');
    const statusCell = row.cells[4]; // 상태 셀
    
    let statusClass, statusText, statusColor;
    
    if (newValue === '-') {
      statusClass = 'notfound';
      statusText = '-';
      statusColor = '#6c757d';
    } else {
      const rank = parseInt(newValue);
      if (rank <= 3) {
        statusClass = 'top-rank';
        statusText = '상위권노출';
        statusColor = '#28a745';
      } else if (rank <= 7) {
        statusClass = 'mid-rank';
        statusText = '하위권노출';
        statusColor = '#f39c12';
      } else if (rank <= 20) {
        statusClass = 'low-rank';
        statusText = '확인필요';
        statusColor = '#dc3545';
      } else {
        statusClass = 'notfound';
        statusText = '-';
        statusColor = '#6c757d';
      }
    }
    
    // 색상 업데이트
    element.style.color = statusColor;
    
    // 상태 셀 업데이트
    statusCell.innerHTML = `
      <span style="padding: 4px 8px; border-radius: 12px; font-size: 0.8em; color: white; background: ${statusColor};">
        ${statusText}
      </span>
    `;
    
    // 행의 data-status 업데이트
    row.setAttribute('data-status', statusClass);
    
    // 수정 표시 추가
    if (!element.querySelector('.edit-indicator')) {
      element.innerHTML += ' <span class="edit-indicator" style="color: #667eea; font-size: 0.8em;" title="수동 수정됨">✏️</span>';
    }
  }
  
  // 키워드 숨기기/보이기 토글 함수
  toggleKeywordVisibility(keyword, blogUrl) {
    // 숨긴 항목 목록 초기화 (키워드+블로그 조합으로 관리)
    if (!this.hiddenItems) {
      this.hiddenItems = new Set();
    }
    
    // 고유 키 생성 (키워드+블로그 조합)
    const itemKey = `${keyword}|||${blogUrl}`;
    
    // 체크박스 찾기 (특정 항목만)
    const checkbox = event.target;
    const isChecked = checkbox.checked;
    
    if (isChecked) {
      // 항목 숨기기 목록에 추가
      this.hiddenItems.add(itemKey);
    } else {
      // 항목 숨기기 목록에서 제거
      this.hiddenItems.delete(itemKey);
    }
    
    // 전체보기 모드일 때만 테이블 업데이트
    if (this.currentViewMode === 'summary') {
      this.createSummaryTable();
    }
    // 개별보기에서는 체크 상태만 유지하고 행은 숨기지 않음
  }
  
  // 프록시를 통한 미리보기 모달 생성
  createProxiedPreviewModal(proxiedSearchUrl, originalSearchUrl, blogUrl, keyword) {
    // 기존 모달이 있으면 제거
    const existingModal = document.querySelector('.search-preview-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const normalizedBlogUrl = this.normalizeUrl(blogUrl);
    const targetBlogId = this.extractBlogId(normalizedBlogUrl);
    const targetPostId = this.extractPostId(normalizedBlogUrl);

    // 로딩 모달 먼저 표시
    this.showLoadingModal(keyword);

    // 프록시를 통해 네이버 페이지 데이터 가져오기
    this.fetchProxiedContent(proxiedSearchUrl, originalSearchUrl, blogUrl, keyword, targetBlogId, targetPostId);
  }

  // 로딩 모달 표시
  showLoadingModal(keyword) {
    const loadingModal = document.createElement('div');
    loadingModal.className = 'search-preview-modal loading-modal';
    loadingModal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content loading-content">
          <div class="loading-header">
            <h3>🔍 네이버 블로그 검색 로딩 중...</h3>
          </div>
          <div class="loading-body">
            <div class="loading-spinner">
              <div class="spinner"></div>
            </div>
            <p>검색어: <strong>"${keyword}"</strong></p>
            <p>프록시 서버를 통해 네이버 페이지를 가져오는 중입니다...</p>
            <button class="cancel-loading-btn" onclick="window.blogRankChecker.closePreviewModal(this)">
              취소
            </button>
          </div>
        </div>
      </div>
    `;

    loadingModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
    `;

    document.body.appendChild(loadingModal);

    // 바깥 영역 클릭 시 모달 닫기
    const overlay = loadingModal.querySelector('.modal-overlay');
    overlay.addEventListener('click', (e) => {
      // 오버레이 자체를 클릭했을 때만 닫기
      if (e.target === overlay) {
        this.closePreviewModal(loadingModal.querySelector('.cancel-loading-btn'));
      }
    });
  }

  // 프록시를 통해 네이버 콘텐츠 가져오기
  async fetchProxiedContent(proxiedSearchUrl, originalSearchUrl, blogUrl, keyword, targetBlogId, targetPostId) {
    try {
      const response = await fetch(proxiedSearchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`프록시 요청 실패: ${response.status}`);
      }

      const htmlContent = await response.text();
      
      // 로딩 모달 제거
      const loadingModal = document.querySelector('.loading-modal');
      if (loadingModal) {
        loadingModal.remove();
      }

      // 실제 미리보기 모달 생성
      this.createContentPreviewModal(htmlContent, originalSearchUrl, blogUrl, keyword, targetBlogId, targetPostId);

    } catch (error) {
      console.error('프록시 콘텐츠 가져오기 실패:', error);
      
      // 로딩 모달 제거
      const loadingModal = document.querySelector('.loading-modal');
      if (loadingModal) {
        loadingModal.remove();
      }

      // 에러 모달 표시
      alert(`네이버 페이지를 가져올 수 없습니다:\n${error.message}\n\n대안: 새 창에서 직접 검색하시겠습니까?`);
      
      // 대안으로 새 창 열기
      window.open(originalSearchUrl, '_blank');
    }
  }

  // 콘텐츠가 포함된 미리보기 모달 생성
  createContentPreviewModal(htmlContent, originalSearchUrl, blogUrl, keyword, targetBlogId, targetPostId) {
    // HTML 콘텐츠 간단 후처리 (작동 검증된 방식으로 복원)
    const processedHtml = htmlContent
      .replace(/src="\//g, 'src="https://search.naver.com/')
      .replace(/href="\//g, 'href="https://search.naver.com/')
      .replace(/url\(\//g, 'url(https://search.naver.com/')
      .replace(/src="\/\/([^"]*)/g, 'src="https://$1') // 프로토콜 상대 URL
      .replace(/href="\/\/([^"]*)/g, 'href="https://$1'); // 프로토콜 상대 URL

    const modal = document.createElement('div');
    modal.className = 'search-preview-modal';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-body" style="overflow: hidden; height: 100%; position: relative;">
            <!-- 검색 결과 콘텐츠 (전체 영역 차지) -->
            <div class="content-frame" id="contentFrame" style="
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              overflow-y: auto; 
              background: white;
            ">
              ${processedHtml}
            </div>
            
            <!-- 네이버 스타일 검색창 (완전한 오버레이) -->
            <div class="fixed-search-area" style="
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              z-index: 1000;
              background: white;
              padding: 8px 0;
              transform: translateY(-100%);
              transition: transform 0.3s ease;
              opacity: 0;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
              border-bottom: 1px solid #19ce60;
            " id="stickySearchBar">
              <div style="
                display: flex;
                align-items: center;
                max-width: 830px;
                margin: 0 auto;
                transform: translateX(-5px);
                padding: 0 15px 0 20px;
                justify-content: space-between;
              ">
                <!-- 좌측: 로고 + 검색창 -->
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 1px;
                  flex: 1;
                ">
                  <!-- 네이버 로고 -->
                  <div style="
                    display: flex;
                    align-items: center;
                    flex-shrink: 0;
                  ">
                    <img src="naver_logo2.png" 
                         alt="NAVER" 
                         loading="eager"
                         style="width: auto; height: 40px;"
                         onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';"
                    />
                    <div style="
                      display: none;
                      color: #03c75a;
                      font-weight: bold;
                      font-size: 24px;
                      font-family: sans-serif;
                    ">NAVER</div>
                  </div>
                  
                  <!-- 검색창 -->
                  <div style="
                    flex: 1;
                    max-width: 460px;
                    position: relative;
                    background: white;
                    border: none;
                    border-radius: 2px;
                    display: flex;
                    align-items: center;
                    height: 40px;
                  ">
                    <input type="text" 
                      value="${keyword}" 
                      readonly
                      style="
                        flex: 1;
                        padding: 0 8px;
                        border: none;
                        outline: none;
                        font-size: 18px;
                        font-family: '맑은 고딕', 'Malgun Gothic', sans-serif;
                        font-weight: bold;
                        background: transparent;
                        height: 100%;
                        color: #333;
                      "
                    />
                  </div>
                </div>
                
                <!-- 우측: 키보드 + 검색 아이콘 -->
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  flex-shrink: 0;
                ">
                  <!-- 키보드 아이콘 -->
                  <button style="
                    background: none;
                    border: none;
                    padding: 8px;
                    cursor: pointer;
                    color: #888;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  " title="입력도구">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/>
                    </svg>
                  </button>
                  
                  <!-- 검색 아이콘 -->
                  <button style="
                    background: none;
                    border: none;
                    padding: 8px;
                    cursor: pointer;
                    color: #03c75a;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  " title="검색">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
    `;

    // body 스크롤 방지 (스크롤 위치 유지하면서)
    // document.body.classList.add('modal-open'); // 제거 - 스크롤 위치 변경 방지
    
    document.body.appendChild(modal);

    // 바깥 영역 클릭 시 모달 닫기
    const overlay = modal.querySelector('.modal-overlay');
    overlay.addEventListener('click', (e) => {
      // 오버레이 자체를 클릭했을 때만 닫기 (모달 내용 클릭 시에는 닫지 않음)
      if (e.target === overlay) {
        this.closePreviewModal(modal.querySelector('.close-btn'));
      }
    });

    // 스크롤 이벤트로 검색창 표시/숨김
    const contentFrame = modal.querySelector('#contentFrame');
    const stickySearchBar = modal.querySelector('#stickySearchBar');
    let lastScrollTop = 0;
    
    if (contentFrame && stickySearchBar) {
      contentFrame.addEventListener('scroll', () => {
        const scrollTop = contentFrame.scrollTop;
        
        // 50px 이상 스크롤했을 때만 검색창 표시
        if (scrollTop > 50) {
          stickySearchBar.style.transform = 'translateY(0)';
          stickySearchBar.style.opacity = '1';
        } else {
          stickySearchBar.style.transform = 'translateY(-100%)';
          stickySearchBar.style.opacity = '0';
        }
        
        lastScrollTop = scrollTop;
      });
    }

    // 자동 가이드 표시
    setTimeout(() => {
      this.showBlogGuide(targetBlogId, targetPostId);
    }, 2000);

    // 별개의 컨트롤 창 생성
    const controlPanel = document.createElement('div');
    controlPanel.className = 'modal-control-panel';
    controlPanel.innerHTML = `
      <div class="control-panel-header">
        <h3>
          <div>🔍 검색 결과 :</div>
          <div>"${keyword}"</div>
        </h3>
      </div>
      <div class="control-panel-buttons">
        <button class="highlight-btn" onclick="window.blogRankChecker.highlightInContent('${targetBlogId}', '${targetPostId}')">
          <div>🎯 블로그 찾기</div>
        </button>
        <button class="open-new-btn" onclick="window.open('${originalSearchUrl}', '_blank')">
          <div>🔗 실제 결과</div>
        </button>
        <button class="screenshot-btn" onclick="window.blogRankChecker.takeScreenshot.call(window.blogRankChecker)">
          <div>📸 스크린샷</div>
        </button>
        <button class="fullscreen-btn" onclick="window.blogRankChecker.toggleFullscreen()">
          <div>⛶ 전체화면</div>
        </button>
        <button class="close-btn" onclick="window.blogRankChecker.closePreviewModal(this)">✕</button>
      </div>
    `;

    document.body.appendChild(controlPanel);

    // 🎯 자동으로 하이라이트 버튼 클릭 (1초 후)
    setTimeout(() => {
      console.log('🎯 Auto-clicking highlight button...');
      this.highlightInContent(targetBlogId, targetPostId);
    }, 1000);
  }

  // 콘텐츠 내에서 블로그 하이라이트
  highlightInContent(targetBlogId, targetPostId) {
    const contentFrame = document.getElementById('contentFrame');
    if (!contentFrame) return;

    // 기존 하이라이트 제거
    const existingHighlights = contentFrame.querySelectorAll('.blog-highlight');
    existingHighlights.forEach(el => {
      el.classList.remove('blog-highlight');
      el.style.border = '';
      el.style.borderRadius = '';
    });

    let blogLinks = [];
    
    // PostID가 있는 경우 정확한 게시물 찾기
    if (targetPostId) {
      // PostID가 포함된 링크 찾기
      const exactSelectors = [
        `a[href*="blog.naver.com/${targetBlogId}/${targetPostId}"]`,
        `a[href*="m.blog.naver.com/${targetBlogId}/${targetPostId}"]`,
        `a[href*="PostView.naver"][href*="blogId=${targetBlogId}"][href*="logNo=${targetPostId}"]`
      ];
      
      exactSelectors.forEach(selector => {
        const links = contentFrame.querySelectorAll(selector);
        blogLinks = blogLinks.concat(Array.from(links));
      });
      
      // 중복 제거
      blogLinks = [...new Set(blogLinks)];
      
      if (blogLinks.length === 0) {
        // PostID가 정확히 일치하는 게시물이 없으면 경고
        console.warn(`⚠️ 정확한 게시물(BlogID: ${targetBlogId}, PostID: ${targetPostId})을 찾지 못했습니다.`);
      }
    } else {
      // PostID가 없는 경우 BlogID만으로 찾기 (기존 동작)
      const blogSelectors = [
        `a[href*="blog.naver.com/${targetBlogId}"]`,
        `a[href*="m.blog.naver.com/${targetBlogId}"]`,
        `a[href*="PostView.naver"][href*="blogId=${targetBlogId}"]`
      ];
      
      blogSelectors.forEach(selector => {
        const links = contentFrame.querySelectorAll(selector);
        blogLinks = blogLinks.concat(Array.from(links));
      });
    }
    
    // 중복 제거
    blogLinks = [...new Set(blogLinks)];
    let highlightCount = 0;
    const highlightedElements = new Set(); // 이미 하이라이트된 요소 추적

    blogLinks.forEach(link => {
      // 가장 바깥 요소 찾기 - li.bx 또는 유사한 최상위 컨테이너
      let targetElement = link;
      let attempts = 0;
      
      while (targetElement && attempts < 10) {
        targetElement = targetElement.parentElement;
        attempts++;
        
        // li.bx 또는 lst_view의 직접 자식 li 요소 찾기
        if (targetElement && (
          (targetElement.tagName === 'LI' && targetElement.classList.contains('bx')) ||
          (targetElement.tagName === 'LI' && targetElement.parentElement && targetElement.parentElement.classList.contains('lst_view'))
        )) {
          break;
        }
      }

      // li.bx 요소를 찾지 못한 경우, 적절한 크기의 부모 요소 찾기
      if (!targetElement || targetElement.tagName !== 'LI') {
        targetElement = link;
        attempts = 0;
        
        while (targetElement && attempts < 5) {
          targetElement = targetElement.parentElement;
          attempts++;
          
          if (targetElement && (
            targetElement.classList.contains('bx') ||
            targetElement.classList.contains('blog') ||
            targetElement.classList.contains('item') ||
            (targetElement.offsetHeight > 100 && targetElement.offsetWidth > 300)
          )) {
            break;
          }
        }
      }

      if (targetElement && !highlightedElements.has(targetElement)) {
        // 이미 하이라이트된 요소의 부모/자식인지 확인
        let shouldHighlight = true;
        
        // 기존 하이라이트된 요소들과 겹치는지 확인
        for (const existingElement of highlightedElements) {
          if (existingElement.contains(targetElement) || targetElement.contains(existingElement)) {
            shouldHighlight = false;
            break;
          }
        }
        
        if (shouldHighlight) {
          highlightedElements.add(targetElement);
          targetElement.classList.add('blog-highlight');
          targetElement.style.border = '3px solid #ff0000';
          targetElement.style.borderRadius = '8px';
          
          // 첫 번째 하이라이트로 스크롤
          if (highlightCount === 0) {
            targetElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }
          highlightCount++;
          
          console.log(`하이라이트 적용: ${targetElement.tagName}.${targetElement.className}`);
        }
      }
    });

    if (highlightCount > 0) {
      if (targetPostId) {
        this.showBlogGuide(targetBlogId, targetPostId);
        console.log(`✅ 게시물(BlogID: ${targetBlogId}, PostID: ${targetPostId})을 하이라이트했습니다.`);
      } else {
        this.showBlogGuide(targetBlogId);
        console.log(`✅ ${highlightCount}개의 블로그 항목을 하이라이트했습니다.`);
      }
    } else {
      if (targetPostId) {
        alert(`⚠️ 게시물을 찾지 못했습니다.\n\n블로그 ID: ${targetBlogId}\n게시물 ID: ${targetPostId}\n\nCtrl+F를 사용해서 직접 검색해보세요.`);
      } else {
        alert(`⚠️ "${targetBlogId}" 블로그를 찾지 못했습니다.\n\nCtrl+F를 사용해서 직접 검색해보세요.`);
      }
    }
  }

  // 검색 미리보기 모달 생성 (백업용)
  createSearchPreviewModal(searchUrl, blogUrl, keyword) {
    // 기존 모달이 있으면 제거
    const existingModal = document.querySelector('.search-preview-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const normalizedBlogUrl = this.normalizeUrl(blogUrl);
    const targetBlogId = this.extractBlogId(normalizedBlogUrl);

    // 모달 컨테이너 생성
    const modal = document.createElement('div');
    modal.className = 'search-preview-modal';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-body">
            <iframe 
              src="${searchUrl}" 
              frameborder="0" 
              style="width: 100%; height: 100vh; border: none;"
              id="previewIframe">
            </iframe>
          </div>
          <div class="modal-footer">
            <div class="guide-info" style="display: none; background: #fff3cd; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
              <strong>🎯 찾고 있는 블로그:</strong> <code>${targetBlogId}</code><br>
              <strong>검색 방법:</strong> iframe 내에서 <kbd>Ctrl+F</kbd>를 누르고 "<code>${targetBlogId}</code>"를 검색하세요.
            </div>
            <p style="color: #666; font-size: 0.9em; margin: 0;">
              💡 팁: iframe 안에서 직접 Ctrl+F로 검색하거나 "대상 게시물 찾기" 버튼을 클릭하세요.
            </p>
          </div>
        </div>
      </div>
    `;

    // 스타일 추가
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
    `;

    // body 스크롤 방지 (스크롤 위치 유지하면서)
    // document.body.classList.add('modal-open'); // 제거 - 스크롤 위치 변경 방지
    
    document.body.appendChild(modal);

    // 별개의 컨트롤 창 생성
    const controlPanel = document.createElement('div');
    controlPanel.className = 'modal-control-panel';
    controlPanel.innerHTML = `
      <div class="control-panel-header">
        <h3>🔍 네이버 블로그 검색: "${keyword}"</h3>
      </div>
      <div class="control-panel-buttons">
        <button class="highlight-btn" onclick="window.blogRankChecker.showBlogGuide('${targetBlogId}')">
          🎯 블로그 찾기
        </button>
        <button class="fullscreen-btn" onclick="window.blogRankChecker.toggleFullscreen()">
          ⛶ 전체화면
        </button>
        <button class="close-btn" onclick="window.blogRankChecker.closePreviewModal(this)">✕</button>
      </div>
    `;

    document.body.appendChild(controlPanel);

    // iframe 로딩 완료 후 안내 표시
    const iframe = modal.querySelector('#previewIframe');
    iframe.onload = () => {
      setTimeout(() => {
        this.showBlogGuide(targetBlogId);
      }, 2000);
    };
  }

  // 블로그 찾기 가이드 표시 (간소화)
  showBlogGuide(targetBlogId, targetPostId) {
    // 콘솔에만 간단한 정보 출력
    if (targetPostId) {
      console.log(`🎯 찾고 있는 게시물 - BlogID: ${targetBlogId}, PostID: ${targetPostId}`);
    } else {
      console.log(`🎯 찾고 있는 블로그 ID: ${targetBlogId}`);
    }
  }

  // 미리보기 모달 닫기
  closePreviewModal(element) {
    const modal = element ? element.closest('.search-preview-modal') : document.querySelector('.search-preview-modal');
    const controlPanel = document.querySelector('.modal-control-panel');
    
    if (modal) {
      modal.remove();
    }
    
    if (controlPanel) {
      controlPanel.remove();
    }
    
    // body 스크롤 복원
    // document.body.classList.remove('modal-open'); // 제거됨
    
    // 저장된 스크롤 위치로 복원
    if (this.savedScrollPosition !== undefined) {
      setTimeout(() => {
        window.scrollTo({
          top: this.savedScrollPosition,
          behavior: 'instant'
        });
      }, 10);
    }
  }

  // 스크린샷 단축키 안내
  takeScreenshot() {
    // 모달이 열려있는지 확인
    const modal = document.querySelector('.search-preview-modal');
    if (!modal || modal.style.display === 'none') {
      this.showToast('❌ 미리보기 모달을 먼저 열어주세요', 'error');
      return;
    }
    
    // 단축키 안내 모달 표시
    this.showScreenshotGuide();
  }

  // 확장 프로그램을 이용한 스크린샷
  async tryExtensionScreenshot() {
    try {
      // 확장 프로그램 설치 확인
      const hasExtension = await this.checkExtensionAvailable();
      
      if (!hasExtension) {
        console.log('확장 프로그램이 설치되지 않음');
        this.showExtensionInstallModal();
        return false;
      }
      
      // 확장 프로그램으로 스크린샷 캡처
      const result = await this.captureWithExtension();
      
      if (result && result.success) {
        this.showToast('📸 스크린샷이 저장되었습니다!', 'success');
        return true;
      } else {
        console.error('확장 프로그램 캡처 실패:', result);
        this.showToast('❌ 스크린샷 캡처에 실패했습니다.', 'error');
        return false;
      }
      
    } catch (error) {
      console.error('확장 프로그램 스크린샷 실패:', error);
      this.showToast('❌ 스크린샷 캡처 중 오류가 발생했습니다.', 'error');
      return false;
    }
  }
  
  // 확장 프로그램 설치 확인
  async checkExtensionAvailable() {
    return new Promise((resolve) => {
      console.log('확장 프로그램 확인 시작...');
      
      // 즉시 확인
      const checkExtension = () => {
        // 1. 확장 프로그램이 content script를 통해 설정한 전역 변수 확인
        if (window.NAVER_BLOG_EXTENSION_READY) {
          console.log('확장 프로그램 감지됨 (전역 변수)');
          this.extensionAvailable = true;
          return true;
        }
        
        // 2. 확장 프로그램 API가 있는지 확인
        if (window.NaverBlogScreenshot && window.NaverBlogScreenshot.isInstalled) {
          console.log('확장 프로그램 감지됨 (API)');
          this.extensionAvailable = true;
          return true;
        }
        
        // 3. DOM에서 확장 프로그램 ID 확인
        if (window.NAVER_BLOG_SCREENSHOT_EXTENSION_ID) {
          console.log('확장 프로그램 감지됨 (DOM ID)');
          this.extensionAvailable = true;
          this.extensionId = window.NAVER_BLOG_SCREENSHOT_EXTENSION_ID;
          return true;
        }
        
        return false;
      };
      
      // 즉시 확인
      if (checkExtension()) {
        resolve(true);
        return;
      }
      
      // postMessage로 ping 테스트 (한 번만)
      const requestId = 'check_' + Date.now();
      let pingResponseReceived = false;
      
      const messageHandler = (event) => {
        if (event.data.type === 'NAVER_BLOG_SCREENSHOT_RESPONSE' && 
            event.data.requestId === requestId) {
          window.removeEventListener('message', messageHandler);
          pingResponseReceived = true;
          console.log('확장 프로그램 ping 응답 받음');
          this.extensionAvailable = true;
          resolve(true);
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // ping 전송
      try {
        window.postMessage({
          type: 'NAVER_BLOG_SCREENSHOT',
          action: 'ping',
          data: { requestId: requestId }
        }, '*');
        console.log('postMessage ping 전송됨');
      } catch (e) {
        console.log('postMessage ping 실패:', e);
      }
      
      // 지연 확인 (최대 3초)
      let checkCount = 0;
      const maxChecks = 30; // 3초간 체크
      
      const checkInterval = setInterval(() => {
        checkCount++;
        
        if (pingResponseReceived) {
          clearInterval(checkInterval);
          return;
        }
        
        if (checkExtension()) {
          console.log('확장 프로그램 감지됨 (지연 로드)');
          clearInterval(checkInterval);
          window.removeEventListener('message', messageHandler);
          resolve(true);
          return;
        }
        
        if (checkCount >= maxChecks) {
          console.log('확장 프로그램 감지 실패');
          clearInterval(checkInterval);
          window.removeEventListener('message', messageHandler);
          this.extensionAvailable = false;
          resolve(false);
        }
      }, 100);
      
    });
  }
  
  // 확장 프로그램으로 스크린샷 캡처
  async captureWithExtension() {
    try {
      console.log('확장 프로그램으로 스크린샷 캡처 시도...');
      
      // 1. NaverBlogScreenshot API 사용 시도
      if (window.NaverBlogScreenshot && window.NaverBlogScreenshot.captureElement) {
        console.log('NaverBlogScreenshot API 사용');
        const result = await window.NaverBlogScreenshot.captureElement('#contentFrame', {
          quality: 1.0,
          scale: 1
        });
        return { success: true, data: result };
      }
      
      // 2. postMessage 방식 사용
      return new Promise((resolve) => {
        const requestId = 'capture_' + Date.now();
        let timeout;
        
        const messageHandler = (event) => {
          if (event.data.type === 'NAVER_BLOG_SCREENSHOT_RESPONSE' && 
              event.data.requestId === requestId) {
            window.removeEventListener('message', messageHandler);
            clearTimeout(timeout);
            console.log('postMessage 응답 수신:', event.data);
            resolve(event.data);
          }
        };
        
        window.addEventListener('message', messageHandler);
        
        // 확장 프로그램에 캡처 요청
        console.log('postMessage로 캡처 요청 전송');
        window.postMessage({
          type: 'NAVER_BLOG_SCREENSHOT',
          action: 'capture',
          data: { 
            requestId,
            element: '#contentFrame',
            options: {
              quality: 1.0,
              scale: 1
            }
          }
        }, '*');
        
        // 10초 타임아웃
        timeout = setTimeout(() => {
          window.removeEventListener('message', messageHandler);
          console.log('확장 프로그램 응답 타임아웃');
          resolve({ success: false, error: '확장 프로그램 응답 없음' });
        }, 10000);
      });
      
    } catch (error) {
      console.error('확장 프로그램 캡처 중 오류:', error);
      return { success: false, error: error.message };
    }
  }
  
  // 스크린샷 단축키 안내 모달
  showScreenshotGuide() {
    const modal = document.createElement('div');
    modal.innerHTML = `
    <div style="
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.8); z-index: 10000; display: flex;
      align-items: center; justify-content: center;
    ">
      <div style="
        background: white; padding: 40px; border-radius: 15px;
        text-align: center; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      ">
        <div style="font-size: 64px; margin-bottom: 20px;">📸</div>
        <h2 style="margin: 0 0 20px 0; color: #333;">스크린샷 캡처 방법</h2>
        
        <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin: 25px 0;">
          <div style="font-size: 28px; font-weight: bold; color: #007bff; margin-bottom: 15px;">
            Ctrl + Q
          </div>
          <div style="color: #666; font-size: 16px; line-height: 1.5;">
            위 단축키를 누르면<br>
            <strong>modal-body 영역만</strong> 정확히 캡처됩니다
          </div>
        </div>
        
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107;">
          <div style="font-weight: bold; color: #856404; margin-bottom: 10px;">📌 사용 방법</div>
          <div style="text-align: left; margin: 0; color: #856404; line-height: 1.6;">
            1. 확장 프로그램을 설치해주세요<br>
            2. 이 모달이 열린 상태에서 단축키를 누르세요<br>
            3. modal-body 바깥 영역은 자동으로 제거됩니다<br>
            4. 파일명은 검색 키워드로 자동 설정됩니다
          </div>
        </div>
        
        <div style="display: flex; gap: 15px; justify-content: center; margin-top: 30px;">
          <button id="installExtensionBtn" style="
            background: #28a745; color: white; border: none;
            padding: 14px 28px; border-radius: 8px; cursor: pointer;
            font-size: 16px; font-weight: 500;
          ">
            설치 방법 보기
          </button>
          <button id="closeGuideBtn" style="
            background: #6c757d; color: white; border: none;
            padding: 14px 28px; border-radius: 8px; cursor: pointer;
            font-size: 16px; font-weight: 500;
          ">
            확인
          </button>
        </div>
      </div>
    </div>
    `;
    
    document.body.appendChild(modal);
    
    // 이벤트 리스너
    document.getElementById('installExtensionBtn').onclick = () => {
      modal.remove();
      this.showInstallGuide();
    };
    
    document.getElementById('closeGuideBtn').onclick = () => {
      modal.remove();
    };
    
    // ESC 키로 닫기
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  }

  // 확장 프로그램 설치 가이드 모달
  showInstallGuide() {
    const modal = document.createElement('div');
    modal.innerHTML = `
    <div style="
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.8); z-index: 10000; display: flex;
      align-items: center; justify-content: center;
    ">
      <div style="
        background: white; padding: 40px; border-radius: 15px;
        text-align: left; max-width: 600px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      ">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="font-size: 48px; margin-bottom: 15px;">⚙️</div>
          <h2 style="margin: 0; color: #333;">확장 프로그램 설치 방법</h2>
        </div>
        
        <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
          <h3 style="margin: 0 0 15px 0; color: #007bff;">📋 설치 단계</h3>
          <div style="color: #333; line-height: 1.8; font-size: 15px;">
            <strong>1단계:</strong> Chrome 주소창에 <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">chrome://extensions/</code> 입력<br>
            <strong>2단계:</strong> 우상단의 "개발자 모드" 토글을 <strong>켜기</strong><br>
            <strong>3단계:</strong> "압축해제된 확장 프로그램을 로드합니다" 버튼 클릭<br>
            <strong>4단계:</strong> <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">modal-screenshot-extension</code> 폴더 선택<br>
            <strong>5단계:</strong> 설치 완료! 이 페이지를 새로고침하세요
          </div>
        </div>
        
        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #28a745;">
          <div style="font-weight: bold; color: #155724; margin-bottom: 8px;">✅ 설치 후 확인 방법</div>
          <div style="color: #155724; line-height: 1.6;">
            • 미리보기 모달을 열고 <strong>Ctrl + Q</strong> 단축키 테스트<br>
            • 우상단에 "저장완료!" 메시지가 뜨면 성공<br>
            • 다운로드 폴더에서 <strong>키워드_screenshot.png</strong> 파일 확인
          </div>
        </div>
        
        <div style="text-align: center;">
          <div style="display: flex; gap: 15px; justify-content: center; align-items: center;">
            <button id="downloadExtensionZip" style="
              background: #6f42c1; color: white; border: none;
              padding: 14px 28px; border-radius: 8px; cursor: pointer;
              font-size: 16px; font-weight: 500;
            ">
              📦 modal-screenshot-extension.zip 다운로드
            </button>
            <button id="closeInstallGuide" style="
              background: #007bff; color: white; border: none;
              padding: 14px 28px; border-radius: 8px; cursor: pointer;
              font-size: 16px; font-weight: 500;
            ">
              확인했습니다
            </button>
          </div>
        </div>
      </div>
    </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('closeInstallGuide').onclick = () => {
      modal.remove();
    };
    
    document.getElementById('downloadExtensionZip').onclick = () => {
      this.downloadExtensionZip();
    };
    
    // ESC 키로 닫기
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  }
  

  




  // 키워드 추출
  extractKeywordFromModal() {
    // 1. 먼저 modal-body 내의 검색창에서 찾기 (네이버 스타일 검색창)
    const searchInput = document.querySelector('.search-preview-modal .modal-body input[type="text"]');
    if (searchInput && searchInput.value) {
      return searchInput.value.trim();
    }
    
    // 2. 컨트롤 패널에서 찾기
    let headerElement = document.querySelector('.modal-control-panel .control-panel-header h3');
    
    // 3. 컨트롤 패널이 없으면 기존 모달 헤더에서 찾기 (호환성)
    if (!headerElement) {
      headerElement = document.querySelector('.search-preview-modal .modal-header h3');
    }
    
    if (headerElement) {
      const text = headerElement.textContent || headerElement.innerText;
      const match = text.match(/"([^"]+)"/);
      return match ? match[1] : '검색결과';
    }
    
    // 4. 현재 저장된 키워드 사용
    if (this.currentPreviewKeyword) {
      return this.currentPreviewKeyword;
    }
    
    return '검색결과';
  }

  // 블로그 URL 추출
  extractBlogUrlFromModal() {
    // 현재 미리보기 중인 블로그 URL 반환
    return this.currentPreviewBlogUrl || '블로그';
  }

  // 순위 추출 (현재 결과에서)
  extractRankFromModal() {
    // 현재 미리보기의 블로그 URL과 키워드에서 순위 찾기
    const blogUrl = this.currentPreviewBlogUrl || '';
    const keyword = this.currentPreviewKeyword || '';
    
    if (blogUrl && keyword && this.currentResults) {
      // currentResults에서 직접 찾기
      for (let result of this.currentResults) {
        const resultBlogUrl = result.url || result.blogUrl || '';
        if (resultBlogUrl === blogUrl && result.keyword === keyword) {
          if (result.rank && result.rank.found && result.rank.position) {
            return `${result.rank.position}위`;
          }
        }
      }
      
      // 테이블에서도 찾기 (백업)
      const rows = document.querySelectorAll('#results tbody tr');
      for (let row of rows) {
        const keywordCell = row.querySelector('td:nth-child(1)');
        const urlCell = row.querySelector('td:nth-child(2)');
        const rankCell = row.querySelector('td:nth-child(3)');
        
        if (keywordCell && urlCell && rankCell) {
          const rowKeyword = keywordCell.textContent.trim();
          const rowUrl = urlCell.textContent.trim();
          const rowRank = rankCell.textContent.trim();
          
          if (rowKeyword === keyword && rowUrl === blogUrl && rowRank !== '-') {
            return rowRank;
          }
        }
      }
    }
    return '미확인';
  }

  // 기본 파일명 생성
  generateDefaultFilename(keyword, rank) {
    const sanitizedKeyword = keyword.replace(/[<>:"/\\|?*]/g, '_');
    const sanitizedRank = rank.replace(/[<>:"/\\|?*]/g, '_');
    
    // rank에 이미 "위"가 포함되어 있으면 그대로 사용, 없으면 "위" 추가
    const finalRank = sanitizedRank.includes('위') ? sanitizedRank : `${sanitizedRank}위`;
    
    return `${sanitizedKeyword}_${finalRank}.png`;
  }





  // iframe 내에서 블로그 하이라이트
  highlightBlogInIframe(blogUrl) {
    try {
      const iframe = document.querySelector('.search-preview-modal iframe');
      if (!iframe) {
        alert('iframe을 찾을 수 없습니다.');
        return;
      }

      const normalizedBlogUrl = this.normalizeUrl(blogUrl);
      const targetBlogId = this.extractBlogId(normalizedBlogUrl);
      if (!targetBlogId) {
        alert('블로그 ID를 추출할 수 없습니다.');
        return;
      }

      // iframe 로딩 대기 후 하이라이트 적용
      iframe.onload = () => {
        setTimeout(() => {
          try {
            // 대체 방법: iframe에 메시지 전송 (CORS 제한으로 인해 직접 접근 불가)
            this.alternativeHighlight(targetBlogId, blogUrl);
          } catch (error) {
            console.error('iframe 하이라이트 실패:', error);
            this.alternativeHighlight(targetBlogId, blogUrl);
          }
        }, 2000);
      };

      // 이미 로드된 경우 즉시 실행
      if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
        setTimeout(() => {
          this.alternativeHighlight(targetBlogId, blogUrl);
        }, 1000);
      }

    } catch (error) {
      console.error('하이라이트 실패:', error);
      this.alternativeHighlight(this.extractBlogId(blogUrl), blogUrl);
    }
  }

  // 전체화면 토글 기능
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error('전체화면 전환 실패:', err);
        alert('전체화면 전환에 실패했습니다.');
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error('전체화면 종료 실패:', err);
      });
    }
  }

  // 대체 하이라이트 방법 (CORS 제한 대응)
  alternativeHighlight(targetBlogId, blogUrl, targetPostId) {
    // 모달에 하이라이트 정보 표시
    const modal = document.querySelector('.search-preview-modal');
    if (modal) {
      let infoDiv = modal.querySelector('.highlight-info');
      if (!infoDiv) {
        infoDiv = document.createElement('div');
        infoDiv.className = 'highlight-info';
        infoDiv.style.cssText = `
          position: absolute;
          top: 80px;
          right: 20px;
          background: #ff0000;
          color: white;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 10001;
          max-width: 300px;
          font-weight: bold;
        `;
        modal.appendChild(infoDiv);
      }

      infoDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <span style="font-size: 1.2em;">🎯</span>
          <strong>대상 게시물 찾기</strong>
        </div>
        <div style="font-size: 0.9em; line-height: 1.4;">
          <strong>블로그 ID:</strong> ${targetBlogId}<br>
          <strong>게시물 ID:</strong> ${targetPostId || '전체'}<br>
          <strong>찾는 방법:</strong><br>
          • "blog.naver.com/${targetBlogId}/${targetPostId || ''}" 포함된 링크를 찾아보세요<br>
          • Ctrl+F로 "${targetPostId || targetBlogId}" 검색해보세요
        </div>
        <button onclick="this.parentElement.remove()" 
                style="position: absolute; top: 5px; right: 8px; background: none; border: none; color: white; font-size: 16px; cursor: pointer;">✕</button>
      `;

      // 5초 후 자동 제거
      setTimeout(() => {
        if (infoDiv && infoDiv.parentElement) {
          infoDiv.remove();
        }
      }, 8000);
    }

    console.log(`🎯 대상 블로그: blog.naver.com/${targetBlogId}`);
  }

  // 대상 블로그에 빨간 테두리 하이라이트 적용
  highlightTargetBlog(document, targetBlogId) {
    try {
      // 네이버 블로그 검색 결과에서 해당 블로그 찾기
      const blogLinks = document.querySelectorAll('a[href*="blog.naver.com"]');
      
      blogLinks.forEach(link => {
        try {
          const href = link.href;
          if (href.includes(`blog.naver.com/${targetBlogId}`)) {
            // 부모 요소 찾기 (검색 결과 항목)
            let parentElement = link;
            let attempts = 0;
            
            // 적절한 부모 요소 찾기 (최대 10단계까지)
            while (parentElement && attempts < 10) {
              parentElement = parentElement.parentElement;
              attempts++;
              
              // 검색 결과 항목으로 보이는 요소 찾기
              if (parentElement && (
                parentElement.classList.contains('bx') ||
                parentElement.classList.contains('blog') ||
                parentElement.classList.contains('item') ||
                parentElement.tagName === 'LI' ||
                (parentElement.offsetHeight > 100 && parentElement.offsetWidth > 300)
              )) {
                break;
              }
            }
            
            if (parentElement) {
              // 빨간 테두리 스타일 적용
              parentElement.style.border = '3px solid #ff0000';
              parentElement.style.borderRadius = '8px';
              parentElement.style.backgroundColor = '#fff5f5';
              parentElement.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.3)';
              parentElement.style.padding = '5px';
              parentElement.style.margin = '5px';
              
              // 스크롤하여 해당 요소로 이동
              parentElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
              });
              
              console.log('대상 블로그 하이라이트 완료:', targetBlogId);
            }
          }
        } catch (error) {
          console.error('개별 링크 처리 실패:', error);
        }
      });
      
    } catch (error) {
      console.error('하이라이트 적용 실패:', error);
    }
  }



  // 로딩 모달 생성
  createLoadingModal(keyword, blogUrl) {
    const modal = document.createElement('div');
    modal.className = 'preview-loading-modal';
    modal.innerHTML = `
      <div class="preview-loading-overlay">
        <div class="preview-loading-content">
          <div class="loading-spinner"></div>
          <h3>📄 페이지 미리보기 로딩 중...</h3>
          <p><strong>키워드:</strong> ${keyword}</p>
          <p><strong>블로그:</strong> ${blogUrl}</p>
          <button onclick="this.closest('.preview-loading-modal').remove()" class="cancel-loading-btn">
            ❌ 취소
          </button>
        </div>
      </div>
    `;
    return modal;
  }

  // 미리보기 모달 생성
  createPreviewModal(html, blogUrl, keyword) {
    // 기존 모달 제거
    const existingModal = document.querySelector('.preview-modal');
    if (existingModal) {
      document.body.removeChild(existingModal);
    }
    
    const modal = document.createElement('div');
    modal.className = 'preview-modal';
    modal.innerHTML = `
      <div class="preview-overlay">
        <div class="preview-content">
          <div class="preview-header">
            <div class="preview-info">
              <h3>📄 페이지 미리보기</h3>
              <p><strong>키워드:</strong> ${keyword}</p>
              <p><strong>블로그:</strong> <a href="${blogUrl}" target="_blank">${blogUrl}</a></p>
            </div>
            <button onclick="this.closest('.preview-modal').remove()" class="close-preview-btn">
              ❌ 닫기
            </button>
          </div>
          <div class="preview-frame-container">
            <iframe class="preview-frame" srcdoc="${html.replace(/"/g, '&quot;')}" sandbox="allow-same-origin"></iframe>
          </div>
        </div>
      </div>
    `;
    
    // body 스크롤 방지 (스크롤 위치 유지하면서)
    // document.body.classList.add('modal-open'); // 제거 - 스크롤 위치 변경 방지
    
    document.body.appendChild(modal);
  }

  // 개별 텍스트 복사 (클릭 복사용)
  async copyText(text, type) {
    if (!text || text === '노출 없음') {
      alert('복사할 데이터가 없습니다.');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      
      // 성공 메시지 (간단한 토스트)
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #28a745;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 10000;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      toast.textContent = `${type} 복사됨!`;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
      }, 1500);
    } catch (error) {
      console.error('복사 실패:', error);
      this.fallbackCopyToClipboard(text, type);
    }
  }

  // 전체 URL 복사
  async copyAllUrls() {
    const tbody = document.getElementById('summaryTableBody');
    if (!tbody) {
      alert('전체보기 테이블을 찾을 수 없습니다.');
      return;
    }

    const rows = tbody.querySelectorAll('.summary-row');
    const urls = [];
    
    rows.forEach(row => {
      const urlCell = row.querySelector('td:first-child');
      if (urlCell) {
        const urlText = urlCell.textContent.trim();
        if (urlText && urlText !== '노출 없음') {
          urls.push(urlText);
        }
      }
    });

    if (urls.length === 0) {
      alert('복사할 URL이 없습니다.');
      return;
    }

    const allUrls = urls.join('\n');
    try {
      await navigator.clipboard.writeText(allUrls);
      alert(`전체 URL ${urls.length}개가 복사되었습니다.`);
    } catch (error) {
      console.error('복사 실패:', error);
      this.fallbackCopyToClipboard(allUrls, '전체 URL');
    }
  }

  // 전체 키워드 복사
  async copyAllKeywords() {
    const tbody = document.getElementById('summaryTableBody');
    if (!tbody) {
      alert('전체보기 테이블을 찾을 수 없습니다.');
      return;
    }

    const rows = tbody.querySelectorAll('.summary-row');
    const allKeywords = [];
    
    rows.forEach(row => {
      const keywordCell = row.querySelector('td:nth-child(2)');
      if (keywordCell) {
        const keywordText = keywordCell.textContent.trim();
        if (keywordText && keywordText !== '노출 없음') {
          allKeywords.push(keywordText);
        }
      }
    });

    if (allKeywords.length === 0) {
      alert('복사할 키워드가 없습니다.');
      return;
    }

    const allKeywordsText = allKeywords.join('\n');
    try {
      await navigator.clipboard.writeText(allKeywordsText);
      alert(`전체 키워드 ${allKeywords.length}개 블로그분이 복사되었습니다.`);
    } catch (error) {
      console.error('복사 실패:', error);
      this.fallbackCopyToClipboard(allKeywordsText, '전체 키워드');
    }
  }

  // 대체 복사 방법 (Clipboard API 실패시)
  fallbackCopyToClipboard(text, type) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      document.execCommand('copy');
      alert(`${type} 복사됨! (대체 방법)`);
    } catch (error) {
      console.error('대체 복사도 실패:', error);
      alert('복사에 실패했습니다.');
    } finally {
      document.body.removeChild(textArea);
    }
  }

  // html2canvas를 이용한 대안 스크린샷
  async captureWithCanvas() {
    try {
      console.log('html2canvas로 스크린샷 시도...');
      
      // html2canvas가 로드되어 있는지 확인
      if (typeof html2canvas === 'undefined') {
        throw new Error('html2canvas 라이브러리가 로드되지 않았습니다.');
      }
      
      // 캡처할 요소 찾기
      const targetElement = document.querySelector('#contentFrame') || 
                           document.querySelector('.modal-body') ||
                           document.querySelector('.search-preview-modal');
      
      if (!targetElement) {
        throw new Error('캡처할 요소를 찾을 수 없습니다.');
      }
      
      console.log('캡처 대상 요소:', targetElement);
      
      // html2canvas로 캡처
      const canvas = await html2canvas(targetElement, {
        allowTaint: true,
        useCORS: true,
        scale: 1,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          // 클론된 문서에서 스타일 정리
          const clonedElement = clonedDoc.querySelector('#contentFrame') || 
                               clonedDoc.querySelector('.modal-body') ||
                               clonedDoc.querySelector('.search-preview-modal');
          if (clonedElement) {
            clonedElement.style.transform = 'none';
            clonedElement.style.position = 'static';
          }
        }
      });
      
      // Canvas를 Blob으로 변환
      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/png', 1.0);
      });
      
      // 파일명 생성
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                       new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      const filename = `blog-screenshot-${timestamp}.png`;
      
      // 파일 다운로드
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('html2canvas 스크린샷 완료:', filename);
      this.showToast('📸 스크린샷이 저장되었습니다! (html2canvas)', 'success');
      
      return true;
      
    } catch (error) {
      console.error('html2canvas 캡처 실패:', error);
      return false;
    }
  }

  // 미리보기 모달 닫기 함수
  closePreviewModal(button) {
    // 모달 찾기
    const modal = document.querySelector('.search-preview-modal');
    const controlPanel = document.querySelector('.modal-control-panel');
    const loadingModal = document.querySelector('.loading-modal');
    
    // 모든 관련 요소 제거
    if (modal) {
      modal.remove();
    }
    if (controlPanel) {
      controlPanel.remove();
    }
    if (loadingModal) {
      loadingModal.remove();
    }
    
    // body 스크롤 복원
    document.body.classList.remove('modal-open');
    
    // 스크롤 위치 복원
    if (this.savedScrollPosition !== undefined) {
      window.scrollTo(0, this.savedScrollPosition);
    }
  }

  // 토스트 메시지 표시
  showToast(message, type = 'info', duration = 3000) {
    // 기존 토스트 제거
    const existingToasts = document.querySelectorAll('.toast-message');
    existingToasts.forEach(toast => toast.remove());

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    
    // 타입별 색상 설정
    let backgroundColor, color;
    switch (type) {
      case 'success':
        backgroundColor = '#28a745';
        color = 'white';
        break;
      case 'error':
        backgroundColor = '#dc3545';
        color = 'white';
        break;
      case 'warning':
        backgroundColor = '#ffc107';
        color = '#212529';
        break;
      case 'info':
      default:
        backgroundColor = '#17a2b8';
        color = 'white';
        break;
    }

    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${backgroundColor};
      color: ${color};
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 10001;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 400px;
      word-wrap: break-word;
      animation: slideIn 0.3s ease-out;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // 애니메이션 CSS 추가
    if (!document.querySelector('#toast-animations')) {
      const style = document.createElement('style');
      style.id = 'toast-animations';
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    // 자동 제거
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
          if (toast.parentElement) {
            toast.remove();
          }
        }, 300);
      }
    }, duration);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.blogRankChecker = new BlogRankChecker();
});
// 캐시 갱신용 주석 - 2025.01.09 수정
