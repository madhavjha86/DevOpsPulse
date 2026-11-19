import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ShieldCheck,
  Zap,
  DollarSign,
  Compass,
  RefreshCw,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Lock,
  Layers,
  ChevronDown,
  Terminal,
  ExternalLink,
  Cpu,
  Flame,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTabPreview, setActiveTabPreview] = useState<'security' | 'sre' | 'finops' | 'iac'>('security');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex(openFaqIndex === idx ? null : idx);
  };

  const fivePillars = [
    {
      title: 'DevSecOps & SBOM',
      icon: ShieldCheck,
      color: 'from-purple-500 to-indigo-600',
      badge: 'Multi-Vector',
      desc: 'Automated SAST, SCA, and secret detection with full CycloneDX 1.5 and SPDX 2.3 software bill of materials generation.',
      points: ['SAST & Secret Detection', 'CycloneDX & SPDX SBOM', 'Container Image CVE Scanning'],
    },
    {
      title: 'SRE & Reliability',
      icon: Activity,
      color: 'from-blue-500 to-cyan-600',
      badge: 'SLO Engine',
      desc: 'Contractual SLA vs internal SLO tracking, dynamic error budget burn rates, live MTTD/MTTR analytics, and on-call rotations.',
      points: ['Multi-Window Burn Rates', 'Live MTTD & MTTR', 'Tiered Escalation Policies'],
    },
    {
      title: 'Cloud FinOps Intelligence',
      icon: DollarSign,
      color: 'from-emerald-500 to-teal-600',
      badge: 'Cost Control',
      desc: 'Multi-cloud AWS, Azure, and GCP expenditure tracking, idle resource detection, and automated cost optimization recommendations.',
      points: ['AWS/Azure/GCP Cost Breakdowns', 'Idle Resource Detection', 'Forecasting & Budgets'],
    },
    {
      title: 'Infrastructure as Code & IDP',
      icon: Compass,
      color: 'from-amber-500 to-orange-600',
      badge: 'Developer Portal',
      desc: 'Terraform plan previews, drift detection, and a Spotify Backstage-style service catalog with opinionated Golden Paths.',
      points: ['Terraform Drift Detection', 'Checkov IaC Compliance', 'Service Catalog & Golden Paths'],
    },
    {
      title: 'Disaster Recovery Readiness',
      icon: RefreshCw,
      color: 'from-rose-500 to-pink-600',
      badge: 'Zero Data Loss',
      desc: 'Verifiable recovery drills measuring exact RPO and RTO against target SLAs with SHA-256 backup snapshot tracking.',
      points: ['Target vs Actual RPO/RTO', 'Drill Certification Engine', 'Encrypted S3 Backup Vault'],
    },
  ];

  const faqs = [
    {
      q: 'Does DevOpsPulse use actual scanner executions or simulated data?',
      a: 'DevOpsPulse executes real static analysis, CVE vulnerability matching, and dependency scanning. We never fabricate vulnerabilities or synthetic scan results. When billing or AI credentials are not configured, the platform displays NOT_CONFIGURED or INSUFFICIENT_DATA rather than guessing.',
    },
    {
      q: 'How does DevOpsPulse handle multi-tenant isolation and security?',
      a: 'The platform enforces strict organization and workspace isolation with 6 granular RBAC roles (SUPER_ADMIN, ORGANIZATION_ADMIN, DEVOPS_ENGINEER, DEVELOPER, SECURITY_ENGINEER, and VIEWER). Scoped API keys are hashed with SHA-256 and verified per request.',
    },
    {
      q: 'Can we generate standard SBOM manifests for compliance audits?',
      a: 'Yes. The Supply Chain engine produces standard CycloneDX 1.5 and SPDX 2.3 JSON documents, tracking package checksums, open-source license risk (GPL/AGPL flags), and vulnerability advisories.',
    },
    {
      q: 'How are internal SLO targets distinguished from customer SLAs?',
      a: 'Our SRE engine explicitly decouples internal targets (e.g., 99.9% uptime with multi-window burn rate alerts) from contractual customer SLAs (e.g., 99.5% with financial credit thresholds), giving engineering teams proactive warning before violating client commitments.',
    },
    {
      q: 'What cloud providers and infrastructure platforms are supported?',
      a: 'DevOpsPulse natively integrates with Amazon Web Services (AWS), Google Cloud Platform (GCP), Microsoft Azure, Docker hosts, Kubernetes clusters, and OpenTelemetry instrumentation agents.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-dark-100 font-sans selection:bg-purple-100 selection:text-[#7C3AED]">
      {/* 1. Premium Sticky Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#7C3AED] to-[#6D28D9] text-white shadow-md shadow-purple-500/25">
              <Activity className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-dark-100">DevOpsPulse</span>
              <span className="hidden sm:inline-flex rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-black text-[#7C3AED] border border-purple-200">
                ENTERPRISE
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-xs font-bold text-dark-300">
            <a href="#pillars" className="hover:text-[#7C3AED] transition-colors">Five Pillars</a>
            <a href="#security" className="hover:text-[#7C3AED] transition-colors">DevSecOps</a>
            <a href="#observability" className="hover:text-[#7C3AED] transition-colors">Observability</a>
            <a href="#finops" className="hover:text-[#7C3AED] transition-colors">FinOps</a>
            <a href="#faq" className="hover:text-[#7C3AED] transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/login')}
            >
              Sign In
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/dashboard')}
              rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
            >
              Launch Console
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        {/* Subtle decorative radial gradients */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-purple-200/50 via-indigo-100/40 to-transparent blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Announcement pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-white/80 px-3.5 py-1 text-xs font-bold text-[#7C3AED] shadow-xs mb-6 backdrop-blur-xs">
            <Sparkles className="h-3.5 w-3.5 text-purple-600 animate-pulse" />
            <span>DevOpsPulse 2.0 • Unified DevSecOps & Cloud Intelligence</span>
          </div>

          <h1 className="mx-auto max-w-4xl text-3xl font-black tracking-tight sm:text-5xl lg:text-6xl text-slate-900 leading-[1.12]">
            The Central Intelligence Engine for{' '}
            <span className="bg-gradient-to-r from-[#7C3AED] via-indigo-600 to-blue-600 bg-clip-text text-transparent">
              Modern Cloud Engineering
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
            Unify CI/CD pipelines, container telemetry, multi-vector SAST/SCA security scanning,
            SRE reliability SLOs, and multi-cloud FinOps into one centralized, AI-assisted platform.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/dashboard')}
              rightIcon={<ArrowRight className="h-4 w-4" />}
              className="shadow-lg shadow-purple-500/25 px-8"
            >
              Explore Live Platform
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate('/register')}
              className="px-8"
            >
              Create Free Organization
            </Button>
          </div>

          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>CycloneDX & SPDX 2.3 Ready</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Multi-Tenant 6-Tier RBAC</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>OpenTelemetry Compatible</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Zero-Fabrication Data Policy</span>
            </div>
          </div>
        </div>

        {/* 3. Interactive Product Dashboard Preview */}
        <div className="mx-auto mt-14 max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-3 sm:p-5 shadow-2xl shadow-indigo-500/10">
            {/* Mock browser header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-3 text-xs font-mono font-medium text-slate-400">
                  console.devopspulse.io/executive-command-center
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                  LIVE CLOUD TELEMETRY
                </span>
              </div>
            </div>

            {/* Interactive Preview Tabs */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {[
                { id: 'security', label: '1. DevSecOps & SBOM' },
                { id: 'sre', label: '2. SRE & Error Budgets' },
                { id: 'finops', label: '3. Cloud FinOps' },
                { id: 'iac', label: '4. IaC & Service Portal' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabPreview(tab.id as any)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                    activeTabPreview === tab.id
                      ? 'bg-[#7C3AED] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Simulated Live View Body */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 sm:p-6 text-left">
              {activeTabPreview === 'security' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Multi-Vector DevSecOps Posture: Grade A</h4>
                      <p className="text-xs text-slate-500">Continuous SAST, SCA, Secret Scanning & SBOM Cataloging</p>
                    </div>
                    <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-[#7C3AED]">
                      18 Packages Analyzed
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-white bg-white p-3 shadow-2xs">
                      <div className="text-[11px] font-bold text-slate-400">SAST & CODE SECURITY</div>
                      <div className="text-xl font-black text-emerald-600 mt-1">0 Critical Issues</div>
                      <div className="text-[11px] text-slate-500">SQLi, Eval, Deserialization clean</div>
                    </div>
                    <div className="rounded-xl border border-white bg-white p-3 shadow-2xs">
                      <div className="text-[11px] font-bold text-slate-400">SECRET DETECTION</div>
                      <div className="text-xl font-black text-emerald-600 mt-1">100% Protected</div>
                      <div className="text-[11px] text-slate-500">AWS keys, GitHub tokens verified</div>
                    </div>
                    <div className="rounded-xl border border-white bg-white p-3 shadow-2xs">
                      <div className="text-[11px] font-bold text-slate-400">SUPPLY CHAIN SBOM</div>
                      <div className="text-xl font-black text-[#7C3AED] mt-1">SPDX & CycloneDX</div>
                      <div className="text-[11px] text-slate-500">SHA-256 integrity hashes matched</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTabPreview === 'sre' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">SRE Reliability: 99.9% Target SLO</h4>
                      <p className="text-xs text-slate-500">Contractual SLA 99.5% • Multi-window burn rate monitoring</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                      Error Budget: 94.2% Remaining
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-white bg-white p-3 shadow-2xs">
                      <div className="text-[11px] font-bold text-slate-400">MEAN TIME TO DETECT</div>
                      <div className="text-xl font-black text-slate-900 mt-1">3.2 Minutes</div>
                      <div className="text-[11px] text-emerald-600">↓ 42% faster detection</div>
                    </div>
                    <div className="rounded-xl border border-white bg-white p-3 shadow-2xs">
                      <div className="text-[11px] font-bold text-slate-400">MEAN TIME TO RESOLVE</div>
                      <div className="text-xl font-black text-slate-900 mt-1">14.5 Minutes</div>
                      <div className="text-[11px] text-emerald-600">Within 30m target</div>
                    </div>
                    <div className="rounded-xl border border-white bg-white p-3 shadow-2xs">
                      <div className="text-[11px] font-bold text-slate-400">ON-CALL ESCALATION</div>
                      <div className="text-xl font-black text-[#7C3AED] mt-1">Primary Active</div>
                      <div className="text-[11px] text-slate-500">Tier-1 auto-escalation armed</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTabPreview === 'finops' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Cloud FinOps: $1,280.00 Recorded Spend</h4>
                      <p className="text-xs text-slate-500">Service-wise allocation across AWS EC2, RDS, and S3</p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                      Actionable Savings: $180.00/mo
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-white bg-white p-3 shadow-2xs">
                      <div className="text-[11px] font-bold text-slate-400">IDLE EBS VOLUMES</div>
                      <div className="text-xl font-black text-slate-900 mt-1">2 Unattached</div>
                      <div className="text-[11px] text-emerald-600">Save $18.40 / mo</div>
                    </div>
                    <div className="rounded-xl border border-white bg-white p-3 shadow-2xs">
                      <div className="text-[11px] font-bold text-slate-400">NAT GATEWAY RUN-RATE</div>
                      <div className="text-xl font-black text-slate-900 mt-1">Optimization Ready</div>
                      <div className="text-[11px] text-emerald-600">Save $64.00 / mo</div>
                    </div>
                    <div className="rounded-xl border border-white bg-white p-3 shadow-2xs">
                      <div className="text-[11px] font-bold text-slate-400">BUDGET THRESHOLDS</div>
                      <div className="text-xl font-black text-emerald-600 mt-1">Healthy</div>
                      <div className="text-[11px] text-slate-500">68% of monthly limit</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTabPreview === 'iac' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Infrastructure as Code & IDP</h4>
                      <p className="text-xs text-slate-500">Terraform Workspaces, Drift Detection & Golden Path Blueprints</p>
                    </div>
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                      Zero Drift Detected
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-white bg-white p-3 shadow-2xs">
                      <div className="text-[11px] font-bold text-slate-400">TERRAFORM WORKSPACES</div>
                      <div className="text-xl font-black text-slate-900 mt-1">production-vpc</div>
                      <div className="text-[11px] text-slate-500">Checkov: PASSED</div>
                    </div>
                    <div className="rounded-xl border border-white bg-white p-3 shadow-2xs">
                      <div className="text-[11px] font-bold text-slate-400">SERVICE CATALOG</div>
                      <div className="text-xl font-black text-slate-900 mt-1">4 Services Registered</div>
                      <div className="text-[11px] text-slate-500">Tier-1 payment-gateway active</div>
                    </div>
                    <div className="rounded-xl border border-white bg-white p-3 shadow-2xs">
                      <div className="text-[11px] font-bold text-slate-400">GOLDEN PATH TEMPLATES</div>
                      <div className="text-xl font-black text-[#7C3AED] mt-1">FastAPI Microservice</div>
                      <div className="text-[11px] text-slate-500">Pre-wired with OTel & CI/CD</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Five Pillars of Infrastructure Excellence */}
      <section id="pillars" className="py-20 bg-white border-y border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs font-black uppercase tracking-wider text-[#7C3AED]">
              Enterprise Architecture
            </span>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Five Pillars of Infrastructure Excellence
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-500 font-medium">
              Purpose-built capabilities engineered to provide full spectrum visibility, ironclad security,
              and continuous operational velocity.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fivePillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="rounded-3xl border border-slate-200 bg-slate-50/50 p-6 sm:p-7 shadow-xs hover:border-[#7C3AED] hover:shadow-lg transition-all group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr ${pillar.color} text-white shadow-md`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[10px] font-black text-slate-700">
                      {pillar.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-[#7C3AED] transition-colors">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                    {pillar.desc}
                  </p>

                  <div className="mt-5 space-y-2 border-t border-slate-200 pt-4">
                    {pillar.points.map((pt) => (
                      <div key={pt} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span>{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Deep Feature Section: DevSecOps & Supply Chain Security */}
      <section id="security" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-[#7C3AED]">
                Zero-Tolerance Code & Container Security
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Multi-Vector SAST, SCA, and CycloneDX SBOM Generation
              </h2>
              <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                Scan source code for injection vulnerabilities and dangerous eval patterns, inspect dependencies
                against current CVE advisories, intercept leaked secrets, and generate verifiable SPDX 2.3 and
                CycloneDX 1.5 SBOM manifests.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  'Static Application Security Testing (SAST) with remediation guides',
                  'Secret scanning detecting AWS access keys, GitHub tokens, and private keys',
                  'Open-source license compliance (GPL/AGPL copyleft risk flagging)',
                  'Container image vulnerability scanning with actionable base image updates',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-[#7C3AED] shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-slate-700">{item}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/security')}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Explore Security Hub
                </Button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <span className="text-xs font-bold text-slate-400">SBOM DOCUMENT PREVIEW (CYCLONEDX 1.5)</span>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                    VALIDATED
                  </span>
                </div>
                <pre className="rounded-2xl bg-slate-900 p-4 font-mono text-[11px] text-purple-300 overflow-x-auto leading-relaxed">
{`{
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "serialNumber": "urn:uuid:7c3aed99-012a-4f51-bce0",
  "version": 1,
  "metadata": {
    "component": {
      "type": "application",
      "name": "DevOpsPulse-Production",
      "version": "2.0.0"
    }
  },
  "components": [
    {
      "type": "library",
      "name": "fastapi",
      "version": "0.115.0",
      "licenses": [{"license": {"id": "MIT"}}],
      "hashes": [{"alg": "SHA-256", "content": "9b1c73..."}]
    }
  ]
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Observability & SRE Reliability */}
      <section id="observability" className="py-20 bg-white border-y border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 order-2 lg:order-1">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Service Dependency Topology</span>
                  <span className="text-xs font-extrabold text-[#7C3AED]">3 Nodes • 2 Edges</span>
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-800">api-gateway → payment-service</span>
                    <span className="text-xs font-bold text-emerald-600">p99: 42ms • OK</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-800">payment-service → postgres-db</span>
                    <span className="text-xs font-bold text-emerald-600">p99: 14ms • OK</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">auth-service → redis-cache</span>
                    <span className="text-xs font-bold text-emerald-600">p99: 4ms • OK</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 order-1 lg:order-2 space-y-6">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                OpenTelemetry Native APM & SRE
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Decoupled Internal SLOs & Contractual Customer SLAs
              </h2>
              <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                Track error budget burn rates across 1-hour, 6-hour, and 24-hour windows. Real-time MTTD and MTTR
                metrics ensure incident response teams meet their reliability targets before SLAs are breached.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  'OpenTelemetry distributed tracing and service dependency map topology',
                  'Multi-window burn rate alert escalation policies',
                  'Live Mean Time to Detect (MTTD) and Mean Time to Resolve (MTTR)',
                  'Primary and secondary on-call engineer shift management',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-slate-700">{item}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/uptime')}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  View SRE Engine
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Cloud FinOps Intelligence */}
      <section id="finops" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-600">
              Cloud Financial Operations
            </span>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Eliminate Cloud Waste Across AWS, Azure & GCP
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-500 font-medium">
              Authentic cost attribution by workspace, repository, and service with automated idle resource
              harvesting and budget surge alerts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="text-xs font-black text-slate-400 uppercase">Multi-Cloud Allocation</div>
              <h3 className="mt-2 text-lg font-extrabold text-slate-900">Service-Wise Cost Tracking</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Break down monthly expenditure across compute, database, and object storage with zero fabricated spend.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="text-xs font-black text-slate-400 uppercase">Idle Resource Detection</div>
              <h3 className="mt-2 text-lg font-extrabold text-slate-900">Automated Savings Actions</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Identify unattached EBS volumes, unassociated Elastic IPs, and over-provisioned Kubernetes nodes.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="text-xs font-black text-slate-400 uppercase">Forecasting & Budgets</div>
              <h3 className="mt-2 text-lg font-extrabold text-slate-900">Predictive Anomaly Alerts</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Forecast monthly run-rates and receive proactive threshold alerts before incurring budget overruns.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Frequently Asked Questions (FAQ) */}
      <section id="faq" className="py-20 bg-white border-t border-slate-200">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-black uppercase tracking-wider text-[#7C3AED]">
              Everything You Need to Know
            </span>
            <h2 className="mt-2 text-3xl font-black text-slate-900 sm:text-4xl">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={faq.q}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex items-center justify-between p-5 text-left text-sm font-extrabold text-slate-900 hover:text-[#7C3AED] transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed border-t border-slate-200/60 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 9. Final Call to Action */}
      <section className="py-20 bg-gradient-to-tr from-[#7C3AED] to-[#5B21B6] text-white text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
            Ready to Upgrade Your Cloud Infrastructure Intelligence?
          </h2>
          <p className="text-base sm:text-lg text-purple-100 max-w-2xl mx-auto font-medium">
            Join modern engineering organizations delivering secure, high-uptime software with DevOpsPulse.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="rounded-2xl bg-white px-8 py-3.5 text-sm font-extrabold text-[#7C3AED] shadow-xl hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <span>Launch Enterprise Console</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate('/register')}
              className="rounded-2xl border border-purple-300 bg-purple-700/50 px-8 py-3.5 text-sm font-extrabold text-white hover:bg-purple-700 transition-all"
            >
              Start Free Organization
            </button>
          </div>
        </div>
      </section>

      {/* 10. Professional Footer */}
      <footer className="border-t border-slate-200 bg-white py-12 text-xs font-semibold text-slate-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#7C3AED] text-white">
              <Activity className="h-4 w-4" />
            </div>
            <span className="font-extrabold text-slate-900 text-sm">DevOpsPulse</span>
            <span className="text-[11px] text-slate-400">© 2026 DevOpsPulse. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <a href="#pillars" className="hover:text-[#7C3AED] transition-colors">Five Pillars</a>
            <a href="#security" className="hover:text-[#7C3AED] transition-colors">DevSecOps</a>
            <a href="#observability" className="hover:text-[#7C3AED] transition-colors">Observability</a>
            <a href="#finops" className="hover:text-[#7C3AED] transition-colors">FinOps</a>
            <a href="#faq" className="hover:text-[#7C3AED] transition-colors">FAQ</a>
            <a
              href="https://github.com/madhavjha86/DevOpsPulse"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#7C3AED] transition-colors flex items-center gap-1"
            >
              <span>GitHub</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
