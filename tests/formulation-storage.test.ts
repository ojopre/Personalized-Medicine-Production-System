// formulation-storage.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface Formulation {
  patientId: Buffer;
  recipeHash: Buffer;
  doctor: string;
  timestamp: number;
  title: string;
  description: string;
  expiryBlock: number;
  active: boolean;
}

interface FormulationVersion {
  updatedRecipeHash: Buffer;
  updateNotes: string;
  timestamp: number;
  doctor: string;
}

interface Category {
  diseaseCategory: string;
  tags: string[];
}

interface Collaborator {
  role: string;
  permissions: string[];
  addedAt: number;
}

interface License {
  expiry: number;
  terms: string;
  active: boolean;
}

interface Status {
  status: string;
  visibility: boolean;
  lastUpdated: number;
}

interface RevenueShare {
  percentage: number;
  totalReceived: number;
}

interface Metadata {
  additionalData: string;
}

interface ContractState {
  paused: boolean;
  admin: string;
  formulationCounter: number;
  formulations: Map<number, Formulation>;
  formulationVersions: Map<string, FormulationVersion>; // Key: `${formulationId}-${version}`
  categories: Map<number, Category>;
  collaborators: Map<string, Collaborator>; // Key: `${formulationId}-${collaborator}`
  licenses: Map<string, License>; // Key: `${formulationId}-${licensee}`
  statuses: Map<number, Status>;
  revenueShares: Map<string, RevenueShare>; // Key: `${formulationId}-${participant}`
  metadatas: Map<number, Metadata>;
}

// Mock contract implementation
class FormulationStorageMock {
  private state: ContractState = {
    paused: false,
    admin: "deployer",
    formulationCounter: 0,
    formulations: new Map(),
    formulationVersions: new Map(),
    categories: new Map(),
    collaborators: new Map(),
    licenses: new Map(),
    statuses: new Map(),
    revenueShares: new Map(),
    metadatas: new Map(),
  };

  private ERR_UNAUTHORIZED = 100;
  private ERR_ALREADY_EXISTS = 101;
  private ERR_NOT_FOUND = 102;
  private ERR_INVALID_HASH = 103;
  private ERR_INVALID_PATIENT_ID = 104;
  private ERR_INVALID_DATA = 105;
  private ERR_PAUSED = 106;
  private ERR_EXPIRED = 107;
  private ERR_MAX_VERSIONS_REACHED = 108;
  private ERR_INVALID_PERCENTAGE = 109;
  private ERR_METADATA_TOO_LONG = 110;
  private MAX_METADATA_LEN = 1000;
  private MAX_TAGS = 10;
  private MAX_PERMISSIONS = 5;
  private MAX_VERSIONS = 50;

  private currentBlockHeight = 1000; // Mock block height

  // Helper to simulate block height increase
  advanceBlock() {
    this.currentBlockHeight += 1;
  }

  pauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = true;
    return { ok: true, value: true };
  }

  unpauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = false;
    return { ok: true, value: true };
  }

  setAdmin(caller: string, newAdmin: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.admin = newAdmin;
    return { ok: true, value: true };
  }

  registerFormulation(
    caller: string,
    patientId: Buffer,
    recipeHash: Buffer,
    title: string,
    description: string,
    expiryBlock: number
  ): ClarityResponse<number> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (patientId.length !== 32) {
      return { ok: false, value: this.ERR_INVALID_PATIENT_ID };
    }
    if (recipeHash.length !== 32) {
      return { ok: false, value: this.ERR_INVALID_HASH };
    }
    const newId = this.state.formulationCounter + 1;
    this.state.formulations.set(newId, {
      patientId,
      recipeHash,
      doctor: caller,
      timestamp: this.currentBlockHeight,
      title,
      description,
      expiryBlock,
      active: true,
    });
    this.state.formulationCounter = newId;
    return { ok: true, value: newId };
  }

  updateFormulationVersion(
    caller: string,
    formulationId: number,
    newRecipeHash: Buffer,
    version: number,
    notes: string
  ): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (newRecipeHash.length !== 32) {
      return { ok: false, value: this.ERR_INVALID_HASH };
    }
    const formulation = this.state.formulations.get(formulationId);
    if (!formulation) {
      return { ok: false, value: this.ERR_NOT_FOUND };
    }
    const isDoctor = formulation.doctor === caller;
    const hasUpdatePerm = this.hasPermission(formulationId, caller, "update");
    if (!isDoctor && !hasUpdatePerm) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (version >= this.MAX_VERSIONS) {
      return { ok: false, value: this.ERR_MAX_VERSIONS_REACHED };
    }
    const key = `${formulationId}-${version}`;
    this.state.formulationVersions.set(key, {
      updatedRecipeHash: newRecipeHash,
      updateNotes: notes,
      timestamp: this.currentBlockHeight,
      doctor: caller,
    });
    return { ok: true, value: true };
  }

  addCategory(
    caller: string,
    formulationId: number,
    category: string,
    tags: string[]
  ): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const formulation = this.state.formulations.get(formulationId);
    if (!formulation) {
      return { ok: false, value: this.ERR_NOT_FOUND };
    }
    const isDoctor = formulation.doctor === caller;
    const hasPerm = this.hasPermission(formulationId, caller, "edit-category");
    if (!isDoctor && !hasPerm) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (tags.length > this.MAX_TAGS) {
      return { ok: false, value: this.ERR_INVALID_DATA };
    }
    this.state.categories.set(formulationId, { diseaseCategory: category, tags });
    return { ok: true, value: true };
  }

  addCollaborator(
    caller: string,
    formulationId: number,
    collaborator: string,
    role: string,
    permissions: string[]
  ): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const formulation = this.state.formulations.get(formulationId);
    if (!formulation || formulation.doctor !== caller) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (permissions.length > this.MAX_PERMISSIONS) {
      return { ok: false, value: this.ERR_INVALID_DATA };
    }
    const key = `${formulationId}-${collaborator}`;
    this.state.collaborators.set(key, {
      role,
      permissions,
      addedAt: this.currentBlockHeight,
    });
    return { ok: true, value: true };
  }

  grantAccessLicense(
    caller: string,
    formulationId: number,
    licensee: string,
    duration: number,
    terms: string
  ): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const formulation = this.state.formulations.get(formulationId);
    if (!formulation) {
      return { ok: false, value: this.ERR_NOT_FOUND };
    }
    const isDoctor = formulation.doctor === caller;
    const hasPerm = this.hasPermission(formulationId, caller, "grant-license");
    if (!isDoctor && !hasPerm) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    const key = `${formulationId}-${licensee}`;
    this.state.licenses.set(key, {
      expiry: this.currentBlockHeight + duration,
      terms,
      active: true,
    });
    return { ok: true, value: true };
  }

  updateStatus(
    caller: string,
    formulationId: number,
    status: string,
    visibility: boolean
  ): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const formulation = this.state.formulations.get(formulationId);
    if (!formulation) {
      return { ok: false, value: this.ERR_NOT_FOUND };
    }
    const isDoctor = formulation.doctor === caller;
    const hasPerm = this.hasPermission(formulationId, caller, "update-status");
    if (!isDoctor && !hasPerm) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.statuses.set(formulationId, {
      status,
      visibility,
      lastUpdated: this.currentBlockHeight,
    });
    return { ok: true, value: true };
  }

  setRevenueShare(
    caller: string,
    formulationId: number,
    participant: string,
    percentage: number
  ): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const formulation = this.state.formulations.get(formulationId);
    if (!formulation || formulation.doctor !== caller) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (percentage > 100) {
      return { ok: false, value: this.ERR_INVALID_PERCENTAGE };
    }
    const key = `${formulationId}-${participant}`;
    this.state.revenueShares.set(key, { percentage, totalReceived: 0 });
    return { ok: true, value: true };
  }

  addMetadata(
    caller: string,
    formulationId: number,
    data: string
  ): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (data.length > this.MAX_METADATA_LEN) {
      return { ok: false, value: this.ERR_METADATA_TOO_LONG };
    }
    const formulation = this.state.formulations.get(formulationId);
    if (!formulation) {
      return { ok: false, value: this.ERR_NOT_FOUND };
    }
    const isDoctor = formulation.doctor === caller;
    const hasPerm = this.hasPermission(formulationId, caller, "edit-metadata");
    if (!isDoctor && !hasPerm) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.metadatas.set(formulationId, { additionalData: data });
    return { ok: true, value: true };
  }

  deactivateFormulation(caller: string, formulationId: number): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const formulation = this.state.formulations.get(formulationId);
    if (!formulation || formulation.doctor !== caller) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.formulations.set(formulationId, { ...formulation, active: false });
    return { ok: true, value: true };
  }

  getFormulation(formulationId: number): ClarityResponse<Formulation | null> {
    const formulation = this.state.formulations.get(formulationId);
    if (!formulation) {
      return { ok: false, value: this.ERR_NOT_FOUND };
    }
    if (!formulation.active || this.currentBlockHeight >= formulation.expiryBlock) {
      return { ok: false, value: this.ERR_EXPIRED };
    }
    return { ok: true, value: formulation };
  }

  getFormulationVersion(formulationId: number, version: number): ClarityResponse<FormulationVersion | null> {
    const key = `${formulationId}-${version}`;
    const versionData = this.state.formulationVersions.get(key);
    return { ok: true, value: versionData ?? null };
  }

  getCategory(formulationId: number): ClarityResponse<Category | null> {
    return { ok: true, value: this.state.categories.get(formulationId) ?? null };
  }

  getCollaborator(formulationId: number, collaborator: string): ClarityResponse<Collaborator | null> {
    const key = `${formulationId}-${collaborator}`;
    return { ok: true, value: this.state.collaborators.get(key) ?? null };
  }

  getLicense(formulationId: number, licensee: string): ClarityResponse<License | null> {
    const key = `${formulationId}-${licensee}`;
    const license = this.state.licenses.get(key);
    if (!license) {
      return { ok: false, value: this.ERR_NOT_FOUND };
    }
    if (!license.active || this.currentBlockHeight >= license.expiry) {
      return { ok: false, value: this.ERR_EXPIRED };
    }
    return { ok: true, value: license };
  }

  getStatus(formulationId: number): ClarityResponse<Status | null> {
    return { ok: true, value: this.state.statuses.get(formulationId) ?? null };
  }

  getRevenueShare(formulationId: number, participant: string): ClarityResponse<RevenueShare | null> {
    const key = `${formulationId}-${participant}`;
    return { ok: true, value: this.state.revenueShares.get(key) ?? null };
  }

  getMetadata(formulationId: number): ClarityResponse<Metadata | null> {
    return { ok: true, value: this.state.metadatas.get(formulationId) ?? null };
  }

  isContractPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.paused };
  }

  getAdmin(): ClarityResponse<string> {
    return { ok: true, value: this.state.admin };
  }

  getFormulationCounter(): ClarityResponse<number> {
    return { ok: true, value: this.state.formulationCounter };
  }

  private hasPermission(formulationId: number, caller: string, permission: string): boolean {
    const key = `${formulationId}-${caller}`;
    const collab = this.state.collaborators.get(key);
    return collab ? collab.permissions.includes(permission) : false;
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  doctor: "doctor_1",
  collaborator: "collab_1",
  licensee: "licensee_1",
  participant: "participant_1",
};

describe("FormulationStorage Contract", () => {
  let contract: FormulationStorageMock;

  beforeEach(() => {
    contract = new FormulationStorageMock();
    vi.resetAllMocks();
  });

  it("should allow admin to pause and unpause the contract", () => {
    const pauseResult = contract.pauseContract(accounts.deployer);
    expect(pauseResult).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: true });

    const registerDuringPause = contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Test Title",
      "Test Desc",
      2000
    );
    expect(registerDuringPause).toEqual({ ok: false, value: 106 });

    const unpauseResult = contract.unpauseContract(accounts.deployer);
    expect(unpauseResult).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: false });
  });

  it("should prevent non-admin from pausing", () => {
    const pauseResult = contract.pauseContract(accounts.doctor);
    expect(pauseResult).toEqual({ ok: false, value: 100 });
  });

  it("should allow doctor to register a new formulation", () => {
    const patientId = Buffer.alloc(32, "patient1");
    const recipeHash = Buffer.alloc(32, "recipe1");
    const result = contract.registerFormulation(
      accounts.doctor,
      patientId,
      recipeHash,
      "Rare Disease Formula",
      "Custom dosage for genetic disorder",
      2000
    );
    expect(result).toEqual({ ok: true, value: 1 });

    const formulation = contract.getFormulation(1);
    expect(formulation.ok).toBe(true);
    expect(formulation.value).toEqual(
      expect.objectContaining({
        patientId,
        recipeHash,
        doctor: accounts.doctor,
        title: "Rare Disease Formula",
        active: true,
      })
    );
  });

  it("should prevent registration with invalid hash or patient ID", () => {
    const invalidBuffer = Buffer.alloc(31);
    let result = contract.registerFormulation(
      accounts.doctor,
      invalidBuffer,
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );
    expect(result).toEqual({ ok: false, value: 104 });

    result = contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      invalidBuffer,
      "Title",
      "Desc",
      2000
    );
    expect(result).toEqual({ ok: false, value: 103 });
  });

  it("should allow doctor to update formulation version", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );

    const newHash = Buffer.alloc(32, "newrecipe");
    const result = contract.updateFormulationVersion(
      accounts.doctor,
      1,
      newHash,
      1,
      "Updated dosage"
    );
    expect(result).toEqual({ ok: true, value: true });

    const version = contract.getFormulationVersion(1, 1);
    expect(version).toEqual({
      ok: true,
      value: expect.objectContaining({
        updatedRecipeHash: newHash,
        updateNotes: "Updated dosage",
      }),
    });
  });

  it("should allow collaborator with permission to update version", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );
    contract.addCollaborator(
      accounts.doctor,
      1,
      accounts.collaborator,
      "Assistant",
      ["update"]
    );

    const result = contract.updateFormulationVersion(
      accounts.collaborator,
      1,
      Buffer.alloc(32),
      1,
      "Collab update"
    );
    expect(result).toEqual({ ok: true, value: true });
  });

  it("should prevent unauthorized version update", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );

    const result = contract.updateFormulationVersion(
      accounts.collaborator,
      1,
      Buffer.alloc(32),
      1,
      "Unauthorized"
    );
    expect(result).toEqual({ ok: false, value: 100 });
  });

  it("should enforce max versions limit", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );

    const result = contract.updateFormulationVersion(
      accounts.doctor,
      1,
      Buffer.alloc(32),
      50,
      "Too many"
    );
    expect(result).toEqual({ ok: false, value: 108 });
  });

  it("should allow adding category and tags", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );

    const result = contract.addCategory(
      accounts.doctor,
      1,
      "Genetic",
      ["tag1", "tag2"]
    );
    expect(result).toEqual({ ok: true, value: true });

    const category = contract.getCategory(1);
    expect(category).toEqual({
      ok: true,
      value: { diseaseCategory: "Genetic", tags: ["tag1", "tag2"] },
    });
  });

  it("should prevent adding too many tags", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );

    const tooManyTags = Array(11).fill("tag");
    const result = contract.addCategory(accounts.doctor, 1, "Cat", tooManyTags);
    expect(result).toEqual({ ok: false, value: 105 });
  });

  it("should allow doctor to add collaborator", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );

    const result = contract.addCollaborator(
      accounts.doctor,
      1,
      accounts.collaborator,
      "Role",
      ["perm1"]
    );
    expect(result).toEqual({ ok: true, value: true });

    const collab = contract.getCollaborator(1, accounts.collaborator);
    expect(collab).toEqual({
      ok: true,
      value: expect.objectContaining({ role: "Role", permissions: ["perm1"] }),
    });
  });

  it("should prevent non-doctor from adding collaborator", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );

    const result = contract.addCollaborator(
      accounts.collaborator,
      1,
      "other",
      "Role",
      ["perm"]
    );
    expect(result).toEqual({ ok: false, value: 100 });
  });

  it("should allow granting license", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );

    const result = contract.grantAccessLicense(
      accounts.doctor,
      1,
      accounts.licensee,
      100,
      "Terms"
    );
    expect(result).toEqual({ ok: true, value: true });

    const license = contract.getLicense(1, accounts.licensee);
    expect(license.ok).toBe(true);
    expect(license.value).toEqual(
      expect.objectContaining({ terms: "Terms", active: true })
    );
  });

  it("should expire license after block height", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );
    contract.grantAccessLicense(accounts.doctor, 1, accounts.licensee, 10, "Terms");

    for (let i = 0; i < 11; i++) {
      contract.advanceBlock();
    }

    const license = contract.getLicense(1, accounts.licensee);
    expect(license).toEqual({ ok: false, value: 107 });
  });

  it("should allow updating status", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );

    const result = contract.updateStatus(accounts.doctor, 1, "Approved", true);
    expect(result).toEqual({ ok: true, value: true });

    const status = contract.getStatus(1);
    expect(status).toEqual({
      ok: true,
      value: { status: "Approved", visibility: true, lastUpdated: 1000 },
    });
  });

  it("should allow setting revenue share", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );

    const result = contract.setRevenueShare(
      accounts.doctor,
      1,
      accounts.participant,
      20
    );
    expect(result).toEqual({ ok: true, value: true });

    const share = contract.getRevenueShare(1, accounts.participant);
    expect(share).toEqual({
      ok: true,
      value: { percentage: 20, totalReceived: 0 },
    });
  });

  it("should prevent invalid percentage", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );

    const result = contract.setRevenueShare(
      accounts.doctor,
      1,
      accounts.participant,
      101
    );
    expect(result).toEqual({ ok: false, value: 109 });
  });

  it("should allow adding metadata", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );

    const data = "Extra info";
    const result = contract.addMetadata(accounts.doctor, 1, data);
    expect(result).toEqual({ ok: true, value: true });

    const metadata = contract.getMetadata(1);
    expect(metadata).toEqual({ ok: true, value: { additionalData: data } });
  });

  it("should prevent long metadata", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );

    const longData = "a".repeat(1001);
    const result = contract.addMetadata(accounts.doctor, 1, longData);
    expect(result).toEqual({ ok: false, value: 110 });
  });

  it("should allow deactivating formulation", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      2000
    );

    const result = contract.deactivateFormulation(accounts.doctor, 1);
    expect(result).toEqual({ ok: true, value: true });

    const formulation = contract.getFormulation(1);
    expect(formulation).toEqual({ ok: false, value: 107 });
  });

  it("should expire formulation after expiry block", () => {
    contract.registerFormulation(
      accounts.doctor,
      Buffer.alloc(32),
      Buffer.alloc(32),
      "Title",
      "Desc",
      1010
    );

    for (let i = 0; i < 11; i++) {
      contract.advanceBlock();
    }

    const formulation = contract.getFormulation(1);
    expect(formulation).toEqual({ ok: false, value: 107 });
  });
});