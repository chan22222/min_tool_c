# SQL 데이터 관리 기능 - 문제 해결 가이드

## 🔧 오류 해결

### 500 Internal Server Error 해결
1. **진단 페이지 실행**
   - 브라우저에서 `/merge2/api/test_db.php` 열기
   - 데이터베이스 연결 상태 확인
   - 테이블 존재 여부 확인
   - PHP 확장 모듈 확인

2. **가능한 원인과 해결책**
   - **테이블이 없는 경우**: `/merge2/api/init_db.php` 실행하여 테이블 생성
   - **권한 문제**: uploads 폴더에 쓰기 권한 확인 (755 또는 777)
   - **PHP 메모리 부족**: php.ini에서 memory_limit 증가
   - **ZIP 확장 없음**: 호스팅 업체에 ZIP 확장 설치 요청

3. **에러 로그 확인**
   - `/merge2/api/error_log.txt` 파일 확인
   - 서버 에러 로그 확인

## 📦 대용량 파일 처리 (10GB+)

### 서버 설정 (php.ini)
```ini
; 필수 설정
memory_limit = -1              ; 무제한 (또는 16G)
max_execution_time = 0         ; 무제한
post_max_size = 12G           ; 12GB
upload_max_filesize = 12G     ; 12GB
max_input_time = -1           ; 무제한

; 권장 설정
max_file_uploads = 200
session.gc_maxlifetime = 7200
```

### .htaccess 설정 (php.ini 접근 불가 시)
```apache
php_value memory_limit -1
php_value max_execution_time 0
php_value post_max_size 12G
php_value upload_max_filesize 12G
php_value max_input_time -1
```

### nginx 설정
```nginx
client_max_body_size 12G;
proxy_read_timeout 3600;
proxy_connect_timeout 3600;
proxy_send_timeout 3600;
send_timeout 3600;
```

## 🚀 기능 개선 내역

### v2.1 (2025-08-20) - 대용량 파일 지원
- ✅ 10GB+ 파일 지원 추가
- ✅ 500 에러 수정
- ✅ 스트리밍 방식 파일 전송
- ✅ 압축 최적화 (이미지는 무압축)
- ✅ 메모리 효율적인 청크 처리
- ✅ 진단 도구 추가 (test_db.php)
- ✅ 상세한 에러 메시지

### v2.0 (초기 전체 백업)
- ✅ ZIP 압축 백업/복원
- ✅ SQL + 이미지 통합 백업

## 📊 성능 최적화 팁

### 백업 속도 향상
1. **압축 레벨 조정**: 이미지 파일은 이미 압축되어 있으므로 ZIP에서 무압축 저장
2. **청크 단위 처리**: 100개 파일마다 버퍼 플러시
3. **스트리밍 다운로드**: 8KB 청크로 전송

### 가져오기 속도 향상
1. **대용량 파일 복사**: 1MB 버퍼로 스트림 복사
2. **트랜잭션 배치**: 데이터베이스 작업을 트랜잭션으로 묶어 처리
3. **중복 체크 최적화**: 인덱스 활용

## 🔍 디버깅 모드

### 개발 환경
- `data_management.php` 사용 (에러 표시 활성화)

### 프로덕션 환경
- `data_management_production.php`로 변경 (에러 로그만 기록)

## 📝 사용 예시

### 대용량 백업 생성
```javascript
// 10GB 이상의 백업도 처리 가능
app.exportFullBackup();
```

### 대용량 백업 복원
```javascript
// 최대 10GB 파일 업로드 지원
app.importFullBackup();
```

## ⚠️ 주의사항

1. **서버 리소스**
   - 대용량 백업 시 CPU/메모리 사용량 증가
   - 충분한 임시 디스크 공간 필요 (백업 크기의 2배)

2. **네트워크**
   - 대용량 파일 전송 시 안정적인 네트워크 필요
   - 타임아웃 설정 확인

3. **브라우저 제한**
   - 일부 브라우저는 대용량 파일 다운로드 제한
   - Chrome/Firefox 최신 버전 권장

## 🆘 추가 지원

문제가 지속되면:
1. `/merge2/api/test_db.php` 실행 결과 확인
2. `/merge2/api/error_log.txt` 내용 확인
3. 호스팅 업체에 PHP 설정 확인 요청