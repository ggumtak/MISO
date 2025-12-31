# 백엔드 에이전트 프롬프트 (복붙용)

역할

너는 이 프로젝트의 백엔드 최적화 엔진 + API 서버를 만든다. 프론트는 다른 앱에서 제작되며, 너의 서버는 HTTP JSON API로만 소통한다.
핵심은 “정확한 정수 최적화(배정표는 정수)”와 “floor 지급 규칙”을 부동소수점 오차 없이 처리하는 것.

도메인 규칙(고정)

- 후보 수 N(기본 5, 확장 가능)
- 예산 B는 정수
- 배정 s_i는 정수, s_i ≥ 0, Σ s_i = B
- 결과는 항상 1명만 승리
- 후보 i 승리 시 지급:
  - payout_i = floor(s_i * m_i) (내림 고정)
  - m_i는 1.2 같은 소수 가능 → float 쓰면 안 됨

floor/소수 처리(반드시)

- 배당 m을 문자열로 입력받아 유리수(분수)로 변환
  - 예: "1.2" → 12/10 → 6/5
- payout은 payout_i = (s_i * a_i) // b_i 로 계산 (정수 나눗셈)

백엔드가 출력해야 하는 공통 지표

- payoutByOutcome[i] = payout_i
- G = min(payout_i)
- EV = Σ p_i * payout_i (p_i는 float 가능하나, 계산은 안정적으로)
- EP = EV - B
- P_loss = Σ p_i where payout_i < B
- (선택) Var, P_ge_T 등 모드 필요 시

모드 요구(여러 가지, 모두 지원)

최소 6개는 반드시 구현:

- all_weather_maximin
  - 목표: maximize G (= min payout)
- hedge_breakeven_then_ev
  - 가능하면 제약 G ≥ B를 만족하는 해 중 EV 최대
  - 불가능하면 status=infeasible 또는 자동 폴백(all_weather) + notes로 안내
- beast_ev_under_maxloss (야수의 심장)
  - params.maxLossPct (0~1)
  - 제약: G ≥ floor(B*(1-maxLossPct))
  - 목표: maximize EV
- ev_under_lossprob_cap
  - params.lossProbCap (0~1)
  - 제약: P_loss ≤ cap
  - 목표: maximize EV
- maximize_prob_ge_target
  - params.targetT (정수)
  - 목표: maximize P(payout ≥ T)
  - 타이브레이크: EV 최대 → G 최대
- sparse_k_focus
  - params.kSparse (정수)
  - 제약: count(s_i > 0) ≤ K
  - 목표: maximize EV (또는 모드 옵션으로 G도 선택 가능)

옵션(가능하면 추가):

- growth_log_utility (Kelly/로그 효용)
- min_variance_under_evmin
- cvar_tail_guard

최적화 접근(정확성 우선)

- N=5, B 수백~수천은 충분히 탐색 가능. 모드가 많으니 “범용 엔진” 권장:
  - 권장 1순위: OR-Tools CP-SAT
  - 정수 제약/목표함수 바꿔가며 해결 쉬움
  - payout_i는 floor가 포함되어 까다로우므로 아래 중 택:
    - (A) payout_i를 “정수 변수”로 두고 payout_i <= (s_i*a_i)/b_i 형태로 상한/하한을 구성해 floor를 보장하거나
    - (B) 가능한 s_i 범위(0..B)에 대해 payout lookup table을 만들어 payout_i = table[s_i]로 모델링(가장 안전하고 단순; N이 작으니 강추)
- 대안: DP
  - 예산 B가 크지 않으면 DP로 분배 탐색 가능
  - 다만 모드가 많아 복잡해질 수 있음

API 설계(프론트와 계약 — 반드시 이 형태로)

Endpoint 1: 최적화

POST /api/optimize

Request JSON:

- budget: int
- candidates: [{name: string, p: number, m: string|number}]
- rounding: "floor" (고정)
- mode: string enum
- params: object (모드별)

Response JSON:

- status: "ok" | "infeasible" | "error"
- allocation: [{name, s}]
- payoutByOutcome: [{name, payout}]
- metrics: {G, EV, EP, P_loss, ...}
- notes: string[] (선택)

Endpoint 2(선택): 프론티어

POST /api/frontier

- 입력: budget, candidates
- 출력: 서로 다른 트레이드오프 해 10~30개
- 각 해: allocation + (G, EV, P_loss)

입력 검증/오류 처리(필수)

- 확률 합계가 1 또는 100이 아니면:
  - 기본은 “그대로” 계산하되 notes에 경고
  - params.normalizeProb=true 옵션이 있으면 정규화해서 사용
- p_i 음수/NaN, m_i ≤ 0, budget ≤ 0 등은 error
- infeasible 시:
  - status="infeasible"
  - notes에 “어떤 제약 때문에 불가능했는지” 명확히 기술
  - 가능하면 “가장 가까운 대안(all_weather 해)”도 같이 제공(선택)

성능/구현 디테일

- N=5, B 최대 10,000 정도까지도 실용적으로 동작하도록
- float 오차 방지:
  - payout 계산은 정수로만
  - 확률 p는 double로 EV 계산해도 되지만, 출력은 소수점 자리수 제한
- CORS 허용(프론트 별도 도메인일 수 있음)

테스트 케이스(반드시 포함)

budget=399
candidates:

- (0.90, "1.2"), (0.01, "50"), (0.04, "20"), (0.01, "50"), (0.04, "20")

검증:

- payout은 floor로 계산
- 모드별로 결과가 논리적으로 타당한지(특히 G/EV/P_loss 일관성)

인도물(백엔드)

- 실행 가능한 API 서버(FastAPI/Express 등 너가 최선 선택)
- README: 실행 방법, 모드/params 문서, 예제 요청/응답
- (가능하면) Dockerfile 또는 간단 실행 스크립트
- (가능하면) /health endpoint

마지막으로(통합 관점 메모)

- 프론트/백엔드가 다른 앱이니까, 둘 다 README에 “API 계약”을 그대로 적어 버전 불일치가 없게 해줘.
- 특히 mode enum 문자열은 프론트/백엔드가 1:1로 일치해야 함.
