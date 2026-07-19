## 목표
아래 폴더의 Android Solitaire 게임을 Web 으로 포팅할 계획 입니다.
원본 소스: c:\github2\solitaire2\src\solitaire\app\src\
참고 소스: c:\github2\freecell\src\webgame\

## 요구사항
1. HTML5의 Canvas를 사용 하십시오.
2. 모바일에서도 동작해야 하며, 폴드7 접은 화면과 펼친 화면이 모두 타겟입니다.
3. 키보드, 마우스, 터치 스크린을 모두 지원 합니다.
4. 포팅 중 버그가 있으면 개선해 주세요.
5. 포팅 후 사운드 효과를 넣어 주세요. 반드시 무료 사운드를 이용해야 합니다.
6. 포팅 후 게임 실패시 카드가 불타거나 바람에 흩날리는 이펙트를 넣어 주세요.
7. Typescript를 사용해 주세요
8. 실행시 인터넷으로 로딩해야 하는 외부 라이브러리는 사용하면 안됩니다. 단, 사운드 효과는 무료 사운드 라이브러리를 사용할 수 있습니다.
9. 게임은 싱글 플레이어로 구현해 주세요.
10. 게임은 완성된 형태로 구현해 주세요. (게임 시작, 카드 이동, 게임 종료 등 모든 기능이 구현되어야 합니다.)
11. 게임 UI는 인터넷 검색으로 보다 좋은 UI가 있으면 참고해서 구현해 주세요.
12. 이미지 리소스는 img 폴더에 있는 것을 사용하세요.
13. 키보드로만으로도 게임을 할 수 있게 해주세요.
14. F1을 누르면 도움말이 나오게 해주세요
15. 브라우저의 IndexDB를 사용해 브라우저를 종료했다 다시켜도 이어하기가 가능하게 해주세요.
16. Ctrl을 누르고 있으면, 카드위에 어떤 키랑 맵핑이 되는지를 보여주세요.
17. 참고 소스의 최대한 많은 부분을 재활용 하세요.

---

## 코드 리뷰 결과 (2026-07-19)

src/ 전체 8개 파일(2,738줄), index.html, tsconfig.json 리뷰 기준.

### 요구사항 충족 현황

| # | 요구사항 | 상태 | 비고 |
|---|---------|------|------|
| 1 | HTML5 Canvas | ✅ | renderer.ts |
| 2 | 모바일 / 폴드7 대응 | ✅ | calcLayout 반응형 + ResizeObserver + orientationchange |
| 3 | 키보드·마우스·터치 지원 | ✅ | input.ts (단, 버그 5 참고) |
| 4 | 포팅 중 버그 개선 | 🔶 | 아래 발견 버그 수정 필요 |
| 5 | 무료 사운드 | ✅ | Web Audio API 합성음 — 외부 파일 자체가 없음 |
| 6 | 실패 시 불/바람 이펙트 | ✅ | startFailEffect (renderer.ts) |
| 7 | TypeScript | ✅ | strict 모드 |
| 8 | 외부 라이브러리 미사용 | ✅ | 의존성 0 |
| 9 | 싱글 플레이어 | ✅ | |
| 10 | 완성된 게임 흐름 | ✅ | 시작/이동/승리/패배/일시정지/포기/다시하기 |
| 11 | UI 개선 참고 | ✅ | 오버레이·토스트·자동완성 버튼 등 |
| 12 | img 폴더 리소스 사용 | ✅ | 카드 52장 + abg/bg, 로드 실패 시 대체 렌더링 |
| 13 | 키보드만으로 플레이 | 🔶 | 부분 시퀀스 이동 불가 (버그 5) |
| 14 | F1 도움말 | ✅ | Esc로는 안 닫힘 (버그 2) |
| 15 | IndexedDB 이어하기 | ✅ | 자동저장(디바운스 800ms) + pagehide/visibilitychange |
| 16 | Ctrl 키 매핑 오버레이 | ✅ | _drawKeyOverlay + blur 시 해제 처리 |
| 17 | 참고 소스 재활용 | ✅ | sound.ts / storage.ts 구조 재사용 |

### 발견된 버그 (수정 필요)

- [x] **1. "다시 하기"가 같은 카드 배열로 재시작되지 않음** — `deal()`에서 초기 배치를 `_initialDeal` 스냅샷으로 저장하고 `restart()` 추가. `_doRestart`는 이펙트 후 `_restartSameDeal()`로 동일 배열 복원. 스냅샷은 IndexedDB에도 저장(`initialDeal`)해 이어하기 후에도 동작.
- [x] **2. Esc로 도움말이 닫히지 않음** — `onEscapeModal` 콜백 추가. Esc 시 도움말/확인 팝업을 먼저 닫도록 우선 처리(main.ts `_handleEscapeModal`).
- [x] **3. N 키로 첫 게임 시작 시 사운드 전체 무음** — `_newGame()`에서 `sound.init()` 호출(키다운 제스처 내). `_restartSameDeal`에도 추가.
- [x] **4. 한글 IME 상태에서 단축키 동작 안 함** — 키 매핑을 `e.key`→`e.code`(KeyS, KeyZ, Digit1…)로 변경. Numpad1~7도 지원.
- [x] **5. 키보드 이동이 전체 시퀀스만 시도** — `_kbMovableCount`가 시퀀스 전체→1장까지 줄여가며 목적지가 수락하는 최대 개수를 찾도록 변경.
- [x] **6. 웨이스트 더블클릭 히트 영역 어긋남** — `_getDeckAt`의 웨이스트 판정 폭을 fan-out 오프셋만큼 확장.
- [x] **7. 승리 후 Z(undo) 시 상태 불일치** — `_undo()`가 state가 play/pause일 때만 동작하도록 차단.
- [x] **8. 확인 팝업 위에서 Esc 시 팝업 뒤 상태 꼬임** — Esc가 팝업을 먼저 닫음(#2). 추가로 확인 팝업이 열려 있으면 `_togglePause` 무시.
- [x] **9. 이펙트 재생 중 카드 이중 표시** — 애니메이션 중인 덱을 `_animDecks`로 추적, `_drawBoard`에서 해당 덱 카드 렌더링 생략.
- [x] **10. 애니메이션이 프레임레이트 종속** — `performance.now()` 기반 dt로 물리 스텝을 스케일(60fps 기준), dt 클램프(0.05s)로 폭주 방지.

### 개선 권장 (선택)

- [x] iOS Safari 대응: `init()`/`play()`에서 AudioContext가 suspended면 `ctx.resume()` 호출.
- [x] `restore()`에 스냅샷 무결성 검증 추가 — `_validateDecks()`로 52장/중복 확인 후 실패 시 null 반환.
- [x] 멀티터치: 드래그를 시작한 터치 `identifier`를 추적(`_activeTouchId`)해 두 번째 손가락의 가로채기 방지.
- [x] `MoveCommand.stockCount` 제거 (serialize/restore/SavedMove에서 정리, 하위호환 위해 필드는 optional 유지).
- [x] `void cardH` / `void this._rafId` 등 noUnusedLocals 우회 코드 정리(`_rafId` 필드 제거, `_drawDragCards` 미사용 구조분해 제거).
