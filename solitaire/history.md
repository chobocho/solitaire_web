# 개발 이력

## 2026-07-19 — 전체 코드 리뷰 및 Todo.md 갱신

- src/ 전체 8개 파일(2,738줄) + index.html 코드 리뷰 수행
- 요구사항 17개 충족 현황 점검: 15개 충족, 2개 부분 충족(키보드 부분 시퀀스 이동, F1 도움말 Esc 닫기)
- 버그 10건 발견하여 Todo.md에 체크리스트로 기록
  - 주요: "다시 하기"가 같은 배열로 재시작되지 않음, 한글 IME에서 단축키 미동작, N 키 시작 시 무음
- 개선 권장 5건 추가 (iOS AudioContext resume, 스냅샷 검증, 멀티터치 등)
- 코드 수정은 하지 않음 (리뷰만 수행)

## 2026-07-19 — 단일 파일 릴리스 빌드

### 작업 내용
`build.sh` / `build.bat`를 단일 자체 완결형 `index.html` 하나만 생성하도록 변경.
CSS·JS 번들·favicon·모든 이미지(70개 PNG)를 data URI로 인라인하여 외부 파일 의존 제거.

### 변경/추가된 파일
| 파일 | 설명 |
|------|------|
| `build.sh` | tsc 타입체크 → esbuild IIFE 번들 → 인라인 → `release/index.html` |
| `build.bat` | 위와 동일 흐름의 Windows 버전 |
| `build-inline.cjs` | CSS/JS/favicon/이미지 인라인 공유 스크립트 (sh·bat 공용) |

### 방식
- `esbuild`로 `src/main.ts` + 모든 모듈을 단일 IIFE로 번들
- `img/` 전체를 base64 data URI 맵(`globalThis.__IMG__`)으로 임베드
- `loadImages()`가 파일 대신 임베드된 data URI를 우선 사용하도록 번들 패치
- 결과: `release/index.html` (약 898KB), 외부 참조 0개 — 파일 하나로 실행

## 2026-04-11 — 초기 구현 (v1.0)

### 작업 내용
Android Solitaire 게임을 HTML5 Canvas + TypeScript 기반 웹 버전으로 포팅

### 구현된 파일
| 파일 | 설명 |
|------|------|
| `src/card.ts` | Card, Figure, CardNumber, Color 타입 (freecell 참조 재사용) |
| `src/deck.ts` | Deck 기반 클래스, FoundationDeck, TableauDeck, StockDeck, WasteDeck |
| `src/solitaire.ts` | 게임 로직 (deal, flipStock, moveCard, moveFromWaste, autoMoveToFoundation, undo, serialize/restore) |
| `src/renderer.ts` | Canvas 렌더링, 레이아웃 계산, 승리/패배 애니메이션 이펙트 |
| `src/input.ts` | 마우스/터치/키보드 입력 처리 |
| `src/sound.ts` | Web Audio API 기반 프로그래매틱 사운드 효과 |
| `src/storage.ts` | IndexedDB 기반 자동저장/불러오기 |
| `src/main.ts` | GameController, 타이머, UI 바인딩 |
| `index.html` | 게임 HTML 구조 |
| `css/style.css` | 반응형 스타일 |

### 주요 기능
- **게임 규칙**: 7열 태블로(킹만 빈 열 허용), 4개 파운데이션(A→K 같은 무늬), 스톡/웨이스트
- **입력**: 마우스 드래그, 터치 드래그, 더블클릭/더블탭 자동이동, 키보드 전체 지원
- **키보드 매핑**: S=스톡, D=웨이스트, Q/W/E/R=파운데이션, 1~7=태블로
- **Ctrl 오버레이**: Ctrl 누르는 동안 각 덱에 키 레이블 표시
- **F1 도움말**: 단축키 및 게임 규칙 설명
- **IndexedDB**: 브라우저 닫아도 이어하기 가능
- **승리 이펙트**: Foundation 카드들이 날아오르는 애니메이션
- **패배 이펙트**: 카드가 바람에 흩날리며 불타는 애니메이션
- **사운드**: Web Audio API로 합성된 카드 놓기/뒤집기/승리/패배/오류음
- **반응형**: 모바일(폴드 7 포함), 태블릿, 데스크톱 대응

### 참조
- Android 원본: `C:\github2\solitaire2\src\solitaire\app\src\`
- 참고 소스: `C:\github2\freecell\src\webgame\` (sound.ts, storage.ts 구조 재사용)
