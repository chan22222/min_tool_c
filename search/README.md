# 네이버 검색량 대량 조회기 - 개선판 v2.0

## 주요 개선사항

### 1. API 키 브라우저 관리
- **브라우저에서 직접 API 키 입력 가능**: 우측 상단의 "API 설정" 버튼 클릭
- **LocalStorage 저장**: API 키가 브라우저에 안전하게 저장되어 브라우저를 닫아도 유지
- **최대 5개 API 지원**: 여러 개의 API를 등록하여 자동 전환

### 2. API 키 파일 관리
- **내보내기**: API 설정을 JSON 파일로 저장
- **가져오기**: 저장된 JSON 파일에서 API 설정 복원
- **팀 공유 가능**: API 설정 파일을 팀원과 공유

### 3. 향상된 기능
- **IndexedDB 캐싱**: 무제한 캐시 저장
- **가상 스크롤**: 대량 데이터도 빠른 렌더링
- **자동 API 전환**: API 제한 시 다음 API로 자동 전환
- **실시간 상태 표시**: 현재 사용 중인 API 시각적 표시

## 설치 방법

1. 웹 서버에 파일 업로드
   - `index_improved.html`
   - `api_improved.php`
   - `test.html` (선택사항)

2. 웹 서버가 PHP를 지원하는지 확인

## 사용 방법

### 1. API 키 설정
1. 우측 상단의 "⚙️ API 설정" 버튼 클릭
2. 네이버 검색광고 API 정보 입력:
   - Customer ID
   - Access License
   - Secret Key
   - API 이름 (선택사항)
3. "💾 저장" 버튼 클릭

### 2. API 키 가져오기/내보내기
- **내보내기**: API 설정 모달에서 "💾 내보내기" 클릭
- **가져오기**: API 설정 모달에서 "📂 가져오기" 클릭 후 JSON 파일 선택

### 3. 검색 실행
1. 키워드 입력 (줄바꿈 또는 쉼표로 구분)
2. 요청 간격 설정 (기본 100ms)
3. "🔍 조회하기" 클릭
4. 결과를 CSV 또는 Excel로 다운로드

## API 키 파일 형식

```json
{
  "version": "2.0",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "configs": [
    {
      "customerId": "YOUR_CUSTOMER_ID",
      "accessLicense": "YOUR_ACCESS_LICENSE",
      "secretKey": "YOUR_SECRET_KEY",
      "name": "API 1"
    }
  ]
}
```

## 보안 주의사항

1. **API 키 보호**: API 키 파일을 안전하게 보관하세요
2. **HTTPS 사용**: 가능한 HTTPS 환경에서 사용하세요
3. **접근 제한**: 필요한 사용자만 접근할 수 있도록 설정하세요

## 문제 해결

### API 호출 실패
- API 키가 올바른지 확인
- 네이버 검색광고 계정이 활성화되어 있는지 확인
- API 일일 제한을 초과하지 않았는지 확인

### 캐시 문제
- "캐시 초기화" 버튼으로 캐시 삭제
- 브라우저 개발자 도구 > Application > IndexedDB에서 수동 삭제 가능

### LocalStorage 문제
- 브라우저 개발자 도구 > Application > Local Storage에서 확인
- `naverApiConfigs` 키 확인 및 수동 편집 가능

## 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: PHP 7.4+
- **Storage**: LocalStorage, IndexedDB
- **라이브러리**: SheetJS (Excel 처리)

## 버전 히스토리

- **v2.0** (2024): 브라우저 API 관리, 파일 가져오기/내보내기
- **v1.0**: 기본 검색 기능, 멀티 API 지원

## 라이선스

이 프로그램은 네이버 검색광고 API를 사용합니다.
API 사용 시 네이버의 이용약관을 준수해야 합니다.