# 🏥 Personalized Medicine Production System

Welcome to a revolutionary blockchain-based platform for managing personalized medicine production! This project addresses the challenges in treating rare diseases by providing an immutable, secure, and transparent system for logging patient-specific formulations. Using the Stacks blockchain and Clarity smart contracts, it ensures traceability, compliance, and data integrity while protecting patient privacy. Pharmaceutical manufacturers, doctors, and regulators can collaborate securely, reducing errors in custom drug formulations and enabling auditable supply chains for rare disease treatments.

## ✨ Features

🔒 Secure registration of patient-specific formulations with encrypted hashes  
📝 Immutable logging of production steps, from formulation to distribution  
✅ Real-time verification of medicine authenticity and compliance  
👥 Role-based access for doctors, manufacturers, patients, and regulators  
🚨 Audit trails for regulatory oversight and dispute resolution  
💊 Integration for tracking rare disease treatments with privacy controls  
🔄 Scalable for multi-party collaboration without centralized trust  

## 🛠 How It Works

This system leverages 8 interconnected Clarity smart contracts to handle different aspects of the personalized medicine lifecycle. Each contract is designed for modularity, security, and efficiency on the Stacks blockchain.

### Smart Contracts Overview

1. **PatientRegistry.clar**: Manages patient registration, assigning unique IDs and storing anonymized profiles (e.g., age, rare disease type) with consent-based access.  
2. **DoctorRegistry.clar**: Registers and verifies licensed medical professionals, allowing them to authorize formulations.  
3. **FormulationStorage.clar**: Stores hashed patient-specific medicine recipes (e.g., dosages, ingredients) submitted by doctors, ensuring immutability.  
4. **ProductionLog.clar**: Logs manufacturing steps, including batch creation, ingredient sourcing, and timestamps for each phase.  
5. **QualityAssurance.clar**: Records QA tests and approvals, flagging any deviations from the formulation.  
6. **DistributionTracker.clar**: Tracks the supply chain from manufacturer to patient, logging deliveries and receipts.  
7. **AccessControl.clar**: Enforces role-based permissions, using principals to grant/revoke access to sensitive data.  
8. **AuditTrail.clar**: Maintains a comprehensive log of all interactions across contracts for regulatory audits.

### For Doctors

- Register yourself via the DoctorRegistry contract.  
- Create a patient profile in PatientRegistry.  
- Submit a custom formulation hash (e.g., SHA-256 of the recipe) to FormulationStorage, including details like ingredients and dosages tailored to the rare disease.  
- Authorize production by calling functions in ProductionLog.

Your actions are timestamped and verifiable, ensuring accountability.

### For Manufacturers

- Verify doctor authorizations through AccessControl.  
- Log production details in ProductionLog, such as mixing timestamps and batch IDs.  
- Perform and record QA checks in QualityAssurance.  
- Update distribution status in DistributionTracker once the medicine is shipped.

This creates an end-to-end immutable record, preventing tampering.

### For Patients

- View your anonymized treatment logs (with consent) via get-patient-details in PatientRegistry.  
- Confirm receipt of medicine by interacting with DistributionTracker, adding a layer of verification.

Empower patients with transparency while maintaining privacy through hashed data.

### For Regulators

- Use AuditTrail to query historical logs across all contracts.  
- Verify compliance by calling verify-formulation or check-production-log in relevant contracts.  
- Access aggregated data without exposing personal info.

Instant audits without relying on centralized databases!

## 🚀 Getting Started

Deploy the contracts on the Stacks testnet using the Clarinet tool. Interact via the Stacks wallet or custom dApp interfaces. This system solves real-world issues like formulation errors, supply chain fraud, and regulatory delays in rare disease treatments by decentralizing trust and logging.