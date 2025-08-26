;; FormulationStorage.clar
;; Core smart contract for storing patient-specific medicine formulations
;; for rare disease treatments on the Stacks blockchain.

;; Constants
(define-constant ERR-UNAUTHORIZED u100)
(define-constant ERR-ALREADY-EXISTS u101)
(define-constant ERR-NOT-FOUND u102)
(define-constant ERR-INVALID-HASH u103)
(define-constant ERR-INVALID-PATIENT-ID u104)
(define-constant ERR-INVALID-DATA u105)
(define-constant ERR-PAUSED u106)
(define-constant ERR-EXPIRED u107)
(define-constant ERR-MAX-VERSIONS-REACHED u108)
(define-constant ERR-INVALID-PERCENTAGE u109)
(define-constant ERR-METADATA-TOO-LONG u110)
(define-constant MAX-METADATA-LEN u1000)
(define-constant MAX-TAGS u10)
(define-constant MAX-PERMISSIONS u5)
(define-constant MAX-VERSIONS u50)
(define-constant MAX-REVENUE-PARTICIPANTS u20)

;; Data Variables
(define-data-var contract-paused bool false)
(define-data-var contract-admin principal tx-sender)
(define-data-var formulation-counter uint u0)

;; Data Maps
(define-map formulations
  { formulation-id: uint }
  {
    patient-id: (buff 32),          ;; Hashed patient identifier
    recipe-hash: (buff 32),         ;; SHA-256 hash of the formulation recipe
    doctor: principal,
    timestamp: uint,
    title: (string-utf8 100),
    description: (string-utf8 500),
    expiry-block: uint,             ;; Block height when formulation expires
    active: bool
  }
)

(define-map formulation-versions
  { formulation-id: uint, version: uint }
  {
    updated-recipe-hash: (buff 32),
    update-notes: (string-utf8 200),
    timestamp: uint,
    doctor: principal
  }
)

(define-map formulation-categories
  { formulation-id: uint }
  {
    disease-category: (string-utf8 50),  ;; e.g., "Rare Genetic Disorder"
    tags: (list 10 (string-utf8 20))     ;; e.g., ["oncology", "pediatric"]
  }
)

(define-map collaborators
  { formulation-id: uint, collaborator: principal }
  {
    role: (string-utf8 50),              ;; e.g., "Consulting Physician"
    permissions: (list 5 (string-utf8 20)),  ;; e.g., ["view", "update"]
    added-at: uint
  }
)

(define-map access-licenses
  { formulation-id: uint, licensee: principal }
  {
    expiry: uint,
    terms: (string-utf8 200),
    active: bool
  }
)

(define-map formulation-status
  { formulation-id: uint }
  {
    status: (string-utf8 20),            ;; e.g., "Draft", "Approved", "In Production"
    visibility: bool,                    ;; Public or private
    last-updated: uint
  }
)

(define-map revenue-shares
  { formulation-id: uint, participant: principal }
  {
    percentage: uint,                    ;; 0-100
    total-received: uint                 ;; In microstacks or other unit
  }
)

(define-map metadata
  { formulation-id: uint }
  {
    additional-data: (string-utf8 1000)  ;; JSON-like string for extra info
  }
)

;; Private Functions
(define-private (is-admin (caller principal))
  (is-eq caller (var-get contract-admin))
)

(define-private (is-doctor (caller principal) (formulation-id uint))
  (let ((formulation (map-get? formulations {formulation-id: formulation-id})))
    (and (is-some formulation)
         (is-eq (get doctor (unwrap-panic formulation)) caller))
  )
)

(define-private (has-permission (caller principal) (formulation-id uint) (permission (string-utf8 20)))
  (let ((collab (map-get? collaborators {formulation-id: formulation-id, collaborator: caller})))
    (and (is-some collab)
         (is-some (index-of? (get permissions (unwrap-panic collab)) permission))))
)

(define-private (check-paused)
  (ok (asserts! (not (var-get contract-paused)) (err ERR-PAUSED)))
)

(define-private (validate-hash (hash (buff 32)))
  (ok (asserts! (is-eq (len hash) u32) (err ERR-INVALID-HASH)))
)

(define-private (validate-patient-id (patient-id (buff 32)))
  (ok (asserts! (is-eq (len patient-id) u32) (err ERR-INVALID-PATIENT-ID)))
)

(define-private (validate-metadata (data (string-utf8 1000)))
  (ok (asserts! (<= (len data) MAX-METADATA-LEN) (err ERR-METADATA-TOO-LONG)))
)

;; Public Functions
(define-public (pause-contract)
  (begin
    (asserts! (is-admin tx-sender) (err ERR-UNAUTHORIZED))
    (ok (var-set contract-paused true))
  )
)

(define-public (unpause-contract)
  (begin
    (asserts! (is-admin tx-sender) (err ERR-UNAUTHORIZED))
    (ok (var-set contract-paused false))
  )
)

(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-admin tx-sender) (err ERR-UNAUTHORIZED))
    (ok (var-set contract-admin new-admin))
  )
)

(define-public (register-formulation 
  (patient-id (buff 32))
  (recipe-hash (buff 32))
  (title (string-utf8 100))
  (description (string-utf8 500))
  (expiry-block uint)
)
  (begin
    (try! (check-paused))
    (try! (validate-patient-id patient-id))
    (try! (validate-hash recipe-hash))
    (let ((new-id (+ (var-get formulation-counter) u1)))
      (map-set formulations
        {formulation-id: new-id}
        {
          patient-id: patient-id,
          recipe-hash: recipe-hash,
          doctor: tx-sender,
          timestamp: block-height,
          title: title,
          description: description,
          expiry-block: expiry-block,
          active: true
        }
      )
      (var-set formulation-counter new-id)
      (ok new-id)
    )
  )
)

(define-public (update-formulation-version
  (formulation-id uint)
  (new-recipe-hash (buff 32))
  (version uint)
  (notes (string-utf8 200))
)
  (begin
    (try! (check-paused))
    (try! (validate-hash new-recipe-hash))
    (asserts! (or (is-doctor tx-sender formulation-id)
                  (has-permission tx-sender formulation-id u"update"))
              (err ERR-UNAUTHORIZED))
    (asserts! (< version MAX-VERSIONS) (err ERR-MAX-VERSIONS-REACHED))
    (map-set formulation-versions
      {formulation-id: formulation-id, version: version}
      {
        updated-recipe-hash: new-recipe-hash,
        update-notes: notes,
        timestamp: block-height,
        doctor: tx-sender
      }
    )
    (ok true)
  )
)

(define-public (add-category
  (formulation-id uint)
  (category (string-utf8 50))
  (tags (list 10 (string-utf8 20)))
)
  (begin
    (try! (check-paused))
    (asserts! (or (is-doctor tx-sender formulation-id)
                  (has-permission tx-sender formulation-id u"edit-category"))
              (err ERR-UNAUTHORIZED))
    (asserts! (<= (len tags) MAX-TAGS) (err ERR-INVALID-DATA))
    (map-set formulation-categories
      {formulation-id: formulation-id}
      {disease-category: category, tags: tags}
    )
    (ok true)
  )
)

(define-public (add-collaborator
  (formulation-id uint)
  (collaborator principal)
  (role (string-utf8 50))
  (permissions (list 5 (string-utf8 20)))
)
  (begin
    (try! (check-paused))
    (asserts! (is-doctor tx-sender formulation-id) (err ERR-UNAUTHORIZED))
    (asserts! (<= (len permissions) MAX-PERMISSIONS) (err ERR-INVALID-DATA))
    (map-set collaborators
      {formulation-id: formulation-id, collaborator: collaborator}
      {role: role, permissions: permissions, added-at: block-height}
    )
    (ok true)
  )
)

(define-public (grant-access-license
  (formulation-id uint)
  (licensee principal)
  (duration uint)
  (terms (string-utf8 200))
)
  (begin
    (try! (check-paused))
    (asserts! (or (is-doctor tx-sender formulation-id)
                  (has-permission tx-sender formulation-id u"grant-license"))
              (err ERR-UNAUTHORIZED))
    (map-set access-licenses
      {formulation-id: formulation-id, licensee: licensee}
      {
        expiry: (+ block-height duration),
        terms: terms,
        active: true
      }
    )
    (ok true)
  )
)

(define-public (update-status
  (formulation-id uint)
  (status (string-utf8 20))
  (visibility bool)
)
  (begin
    (try! (check-paused))
    (asserts! (or (is-doctor tx-sender formulation-id)
                  (has-permission tx-sender formulation-id u"update-status"))
              (err ERR-UNAUTHORIZED))
    (map-set formulation-status
      {formulation-id: formulation-id}
      {
        status: status,
        visibility: visibility,
        last-updated: block-height
      }
    )
    (ok true)
  )
)

(define-public (set-revenue-share
  (formulation-id uint)
  (participant principal)
  (percentage uint)
)
  (begin
    (try! (check-paused))
    (asserts! (is-doctor tx-sender formulation-id) (err ERR-UNAUTHORIZED))
    (asserts! (<= percentage u100) (err ERR-INVALID-PERCENTAGE))
    (map-set revenue-shares
      {formulation-id: formulation-id, participant: participant}
      {percentage: percentage, total-received: u0}
    )
    (ok true)
  )
)

(define-public (add-metadata
  (formulation-id uint)
  (data (string-utf8 1000))
)
  (begin
    (try! (check-paused))
    (try! (validate-metadata data))
    (asserts! (or (is-doctor tx-sender formulation-id)
                  (has-permission tx-sender formulation-id u"edit-metadata"))
              (err ERR-UNAUTHORIZED))
    (map-set metadata
      {formulation-id: formulation-id}
      {additional-data: data}
    )
    (ok true)
  )
)

(define-public (deactivate-formulation (formulation-id uint))
  (let ((formulation (map-get? formulations {formulation-id: formulation-id})))
    (try! (check-paused))
    (asserts! (is-some formulation) (err ERR-NOT-FOUND))
    (asserts! (is-doctor tx-sender formulation-id) (err ERR-UNAUTHORIZED))
    (map-set formulations
      {formulation-id: formulation-id}
      (merge (unwrap-panic formulation) {active: false})
    )
    (ok true)
  )
)

;; Read-Only Functions
(define-read-only (get-formulation (formulation-id uint))
  (let ((formulation (map-get? formulations {formulation-id: formulation-id})))
    (match formulation
      some-form
      (if (and (get active some-form) (< block-height (get expiry-block some-form)))
        (ok some-form)
        (err ERR-EXPIRED)
      )
      (err ERR-NOT-FOUND)
    )
  )
)

(define-read-only (get-formulation-version (formulation-id uint) (version uint))
  (map-get? formulation-versions {formulation-id: formulation-id, version: version})
)

(define-read-only (get-category (formulation-id uint))
  (map-get? formulation-categories {formulation-id: formulation-id})
)

(define-read-only (get-collaborator (formulation-id uint) (collaborator principal))
  (map-get? collaborators {formulation-id: formulation-id, collaborator: collaborator})
)

(define-read-only (get-license (formulation-id uint) (licensee principal))
  (let ((license (map-get? access-licenses {formulation-id: formulation-id, licensee: licensee})))
    (match license
      some-license
      (if (and (get active some-license) (< block-height (get expiry some-license)))
        (ok some-license)
        (err ERR-EXPIRED)
      )
      (err ERR-NOT-FOUND)
    )
  )
)

(define-read-only (get-status (formulation-id uint))
  (map-get? formulation-status {formulation-id: formulation-id})
)

(define-read-only (get-revenue-share (formulation-id uint) (participant principal))
  (map-get? revenue-shares {formulation-id: formulation-id, participant: participant})
)

(define-read-only (get-metadata (formulation-id uint))
  (map-get? metadata {formulation-id: formulation-id})
)

(define-read-only (is-contract-paused)
  (var-get contract-paused)
)

(define-read-only (get-admin)
  (var-get contract-admin)
)

(define-read-only (get-formulation-counter)
  (var-get formulation-counter)
)