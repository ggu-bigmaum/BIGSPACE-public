# BIGSPACE Oracle Cloud 배포 가이드

> Oracle Cloud Free Tier 기준 | Rocky Linux 8

---

## 1단계: 서버 접속

### SSH 접속
```bash
ssh -i C:\경로\your-key.pem rocky@168.107.19.25
```

> **주의:** 유저명은 반드시 `rocky`입니다. `opc`가 아닙니다.

### 서버 초기 설정 (최초 1회)

**스왑 설정 (Free Tier 메모리 보완)**
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Node.js 설치**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node -v
```

**PM2 설치**
```bash
sudo npm install -g pm2
```

---

## 2단계: PostgreSQL + PostGIS 설치

```bash
sudo dnf install -y postgresql-server postgresql
sudo postgresql-setup --initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

**pg_hba.conf 인증 방식 변경 (md5로)**
```bash
sudo sed -i 's/^host\(.*\)ident/host\1md5/' /var/lib/pgsql/data/pg_hba.conf
sudo systemctl restart postgresql
```

**DB 및 유저 생성**
```bash
sudo -u postgres psql
```
```sql
CREATE USER bigspace WITH PASSWORD '비밀번호';
CREATE DATABASE bigspace OWNER bigspace;
\c bigspace
CREATE EXTENSION postgis;
\q
```

**PostGIS 설치**
```bash
sudo dnf install -y postgis
```

---

## 3단계: DB 데이터 전송

### 로컬 PC (Windows)에서 덤프

특정 테이블만 덤프:
```bash
pg_dump -h localhost -U postgres -d Test \
  -t layers -t features -t basemaps -t app_settings \
  -t administrative_boundaries -t boundary_aggregate_cache \
  -F c -f bigspace.dump
```

### 서버로 파일 전송 (SCP)

```bash
scp -i C:\경로\your-key.pem bigspace.dump rocky@168.107.19.25:/home/rocky/
```

### 서버에서 복원

```bash
pg_restore -h localhost -U bigspace -d bigspace -F c /home/rocky/bigspace.dump
```

---

## 4단계: 앱 배포

### 코드 클론
```bash
cd ~
git clone https://github.com/your-repo/bigspace.git
cd bigspace
```

> GitHub Personal Access Token 필요 시: 비밀번호 입력란에 토큰 입력

### .env 파일 생성
```bash
cat > .env << 'EOF'
DATABASE_URL=postgresql://bigspace:비밀번호@localhost:5432/bigspace
VITE_VWORLD_KEY=발급받은키
VWORLD_DOMAIN=168.107.19.25
EOF
```

### 패키지 설치 및 실행
```bash
npm install
pm2 start npm --name bigspace -- run start
pm2 save
pm2 startup
```

---

## 5단계: 포트 오픈

### Oracle Cloud VCN Security List 설정

Oracle Cloud 콘솔 → Networking → Virtual Cloud Networks → 해당 VCN → Security Lists

**Ingress Rule 추가:**
| 항목 | 값 |
|------|-----|
| Source CIDR | 0.0.0.0/0 |
| IP Protocol | TCP |
| **Destination Port Range** | 5000 |

> Source Port Range는 비워두세요. Destination Port Range에 5000 입력.

### 서버 방화벽 설정
```bash
sudo dnf install -y firewalld
sudo systemctl enable firewalld
sudo systemctl start firewalld
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --reload
```

---

## 코드 업데이트 (배포 후)

서버에서:
```bash
cd ~/bigspace
git pull
pm2 restart bigspace
```

---

## VWorld WMS/WFS 설정

서버 .env에 추가:
```
VWORLD_DOMAIN=168.107.19.25
```

VWorld 콘솔 (map.vworld.kr) → API 키 관리 → 도메인 등록:
- `168.107.19.25` 추가

---

## 가상 클라우드 삭제 순서

> ⚠️ 삭제는 역순으로 진행해야 합니다.

1. **인스턴스 종료** - Compute → Instances → 인스턴스 선택 → Terminate
2. **인터넷 게이트웨이 삭제** - VCN → Internet Gateways → Delete
3. **서브넷 삭제** - VCN → Subnets → Delete
4. **라우트 테이블 삭제** - VCN → Route Tables → Delete (Default 제외)
5. **Security List 정리** - Default Security List는 VCN 삭제 시 자동 삭제
6. **VCN 삭제** - VCN → Delete

> 순서를 지키지 않으면 "리소스가 연결되어 있어 삭제 불가" 오류 발생

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `Permission denied` (SCP) | opc 유저 사용 | `rocky@` 로 변경 |
| `Peer authentication failed` | pg_hba.conf 미수정 | md5로 변경 후 재시작 |
| `type "geometry" does not exist` | PostGIS 미설치 | `sudo dnf install -y postgis` |
| `pg_restore: end of file` | 절대경로 오류 | `/home/rocky/bigspace.dump` 사용 |
| 포트 접속 불가 | VCN 또는 방화벽 미설정 | Destination Port Range 확인 |
| WMS 인증 오류 | DOMAIN 불일치 | .env VWORLD_DOMAIN 및 VWorld 콘솔 도메인 등록 확인 |
| `.env` 파싱 오류 | 빈 줄 포함 | 빈 줄 제거 후 재작성 |
