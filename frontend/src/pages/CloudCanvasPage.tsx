import React, { useEffect, useState } from 'react';
import {
  Boxes,
  Plus,
  Trash2,
  Play,
  Copy,
  Check,
  Download,
  AlertTriangle,
  DollarSign,
  Cloud,
  Layers,
  Database,
  Cpu,
  Globe,
  HardDrive,
  Zap,
  Server,
  RefreshCw,
  Eye,
} from 'lucide-react';
import {
  iacCanvasApi,
  CanvasDiagram,
  CanvasNode,
  CanvasGenerateTerraformResponse,
  CanvasApplyResponse,
} from '../services/iacCanvas';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const RESOURCE_CATALOG = [
  { type: 'vpc', label: 'Virtual Private Cloud', icon: Globe, defaultCost: 0, desc: 'Isolated network envelope (10.0.0.0/16)' },
  { type: 'alb', label: 'Application Load Balancer', icon: Layers, defaultCost: 22.5, desc: 'High-availability HTTP/HTTPS ingress' },
  { type: 'ec2', label: 'EC2 API Compute Node', icon: Cpu, defaultCost: 30.36, desc: 't3.medium (2 vCPU, 4GB RAM)' },
  { type: 'rds', label: 'RDS PostgreSQL DB', icon: Database, defaultCost: 74.15, desc: 'db.t3.medium Multi-AZ + 50GB gp3' },
  { type: 's3', label: 'S3 Object Storage Bucket', icon: HardDrive, defaultCost: 4.5, desc: 'AES-256 encrypted storage' },
  { type: 'eks', label: 'EKS Kubernetes Cluster', icon: Boxes, defaultCost: 133.0, desc: 'Managed K8s control plane + nodes' },
  { type: 'redis', label: 'ElastiCache Redis', icon: Zap, defaultCost: 28.0, desc: 'cache.t4g.micro in-memory session store' },
  { type: 'lambda', label: 'Serverless Lambda Function', icon: Server, defaultCost: 2.0, desc: 'Event-driven Python 3.12 runtime' },
];

const DEFAULT_NODES: CanvasNode[] = [
  { id: 'node-vpc-1', type: 'vpc', label: 'VPC (10.0.0.0/16)', x: 100, y: 80, config: { cidr_block: '10.0.0.0/16' } },
  { id: 'node-alb-1', type: 'alb', label: 'Public App Load Balancer', x: 350, y: 80, config: { scheme: 'internet-facing' } },
  { id: 'node-ec2-1', type: 'ec2', label: 'API Cluster (t3.medium)', x: 350, y: 220, config: { instance_type: 't3.medium', count: 2 } },
  { id: 'node-rds-1', type: 'rds', label: 'PostgreSQL DB (db.t3.medium)', x: 350, y: 360, config: { engine: 'postgres', instance_class: 'db.t3.medium', storage: 50 } },
  { id: 'node-s3-1', type: 's3', label: 'Media & Backups (S3)', x: 600, y: 220, config: { versioning: true } },
];

export default function CloudCanvasPage() {
  const [nodes, setNodes] = useState<CanvasNode[]>(() => {
    try {
      const saved = localStorage.getItem('devopspulse_canvas_nodes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load saved canvas nodes', e);
    }
    return DEFAULT_NODES;
  });

  const [region, setRegion] = useState('us-east-1');
  const [environment, setEnvironment] = useState('production');
  const [tfAnalysis, setTfAnalysis] = useState<CanvasGenerateTerraformResponse | null>(null);
  const [loadingTf, setLoadingTf] = useState(false);
  const [copiedTf, setCopiedTf] = useState(false);

  // Apply Modal
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResult, setApplyResult] = useState<CanvasApplyResponse | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('devopspulse_canvas_nodes', JSON.stringify(nodes));
    } catch (e) {
      console.error('Failed to save canvas nodes', e);
    }
    generateHCL();
  }, [nodes, region, environment]);

  const generateHCL = async () => {
    try {
      setLoadingTf(true);
      const res = await iacCanvasApi.generateTerraform({
        provider: 'aws',
        region,
        environment,
        nodes,
      });
      setTfAnalysis(res);
    } catch (err) {
      console.error('Failed to generate Terraform', err);
    } finally {
      setLoadingTf(false);
    }
  };

  const handleAddResource = (item: (typeof RESOURCE_CATALOG)[0]) => {
    const newId = `node-${item.type}-${Math.random().toString(36).substring(7)}`;
    const newNode: CanvasNode = {
      id: newId,
      type: item.type as any,
      label: item.label,
      x: 200 + nodes.length * 20,
      y: 100 + nodes.length * 25,
      config: {},
    };
    setNodes([...nodes, newNode]);
  };

  const handleRemoveNode = (id: string) => {
    setNodes(nodes.filter((n) => n.id !== id));
  };

  const handleCopyTf = () => {
    if (!tfAnalysis?.hcl_code) return;
    navigator.clipboard.writeText(tfAnalysis.hcl_code);
    setCopiedTf(true);
    setTimeout(() => setCopiedTf(false), 2000);
  };

  const handleDownloadTf = () => {
    if (!tfAnalysis?.hcl_code) return;
    const blob = new Blob([tfAnalysis.hcl_code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devopspulse-main-${environment}.tf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApply = async () => {
    if (!tfAnalysis?.hcl_code) return;
    try {
      setApplyLoading(true);
      const res = await iacCanvasApi.applyTerraform({
        hcl_code: tfAnalysis.hcl_code,
        environment: environment as any,
        dry_run: true,
      });
      setApplyResult(res);
    } catch (err) {
      console.error('Failed to run terraform apply', err);
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#7C3AED] shadow-sm">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Cloud Architecture Canvas
                </h1>
                <Badge variant="info">Visual IaC to Terraform</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Drag, compose, and deploy multi-cloud infrastructure with live HashiCorp Terraform HCL generation, FinOps cost estimation, and security guardrails.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
          >
            <option value="production">production</option>
            <option value="staging">staging</option>
            <option value="development">development</option>
          </select>

          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setIsApplyModalOpen(true);
              handleApply();
            }}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-sm"
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Plan & Apply
          </Button>
        </div>
      </div>

      {/* Main Layout: Left Palette + Center Canvas + Right Terraform Editor */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Component Palette (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-subtle">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Cloud Resource Palette
            </h3>
            <p className="text-xs text-slate-400 mb-3.5">
              Click any resource to add it to your canvas.
            </p>
            <div className="space-y-2">
              {RESOURCE_CATALOG.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    onClick={() => handleAddResource(item)}
                    className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-left transition hover:border-[#7C3AED]/40 hover:bg-purple-50/40 hover:shadow-sm"
                  >
                    <div className="rounded-lg bg-white p-2 text-[#7C3AED] shadow-2xs shrink-0 border border-slate-100">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{item.label}</span>
                        <span className="text-[10px] text-emerald-700 font-bold font-mono">
                          {item.defaultCost === 0 ? 'Free' : `+$${item.defaultCost}/mo`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* FinOps Cost Summary Badge */}
          {tfAnalysis && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-subtle">
              <div className="flex items-center gap-2 text-emerald-800 mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Estimated Cloud Cost</span>
              </div>
              <div className="text-2xl font-extrabold text-emerald-800 font-mono">
                ${tfAnalysis.estimated_cost_monthly_usd.toFixed(2)}
                <span className="text-xs font-normal text-emerald-600"> / month</span>
              </div>
              <p className="mt-1 text-xs text-emerald-700">
                Calculated across {tfAnalysis.resource_count} active cloud resources in {region}.
              </p>
            </div>
          )}

          {/* Security Guardrail Warnings */}
          {tfAnalysis?.security_warnings && tfAnalysis.security_warnings.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-subtle">
              <div className="flex items-center gap-2 text-amber-800 mb-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span className="text-xs font-bold uppercase tracking-wider">Architecture Guardrails</span>
              </div>
              <ul className="space-y-1.5 text-xs text-amber-900">
                {tfAnalysis.security_warnings.map((w, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Center: Visual Canvas (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-subtle">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Live Architecture Topology</h2>
                <Badge variant="neutral">{nodes.length} Components</Badge>
                <Badge variant="success">Auto-Saved</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setNodes(DEFAULT_NODES)}
                  className="text-xs text-slate-600 hover:text-slate-900"
                  title="Reset to default 5 components"
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setNodes([])}
                  className="text-xs text-rose-600 hover:text-rose-700"
                >
                  Clear All
                </Button>
              </div>
            </div>

            {/* Visual Canvas Block Area */}
            <div className="min-h-[460px] rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 relative overflow-y-auto space-y-3">
              {nodes.length === 0 ? (
                <div className="flex h-80 flex-col items-center justify-center text-center text-slate-400">
                  <Boxes className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-600">Canvas is Empty</p>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    Click items in the palette on the left to assemble your cloud topology.
                  </p>
                </div>
              ) : (
                nodes.map((node, idx) => {
                  return (
                    <div
                      key={node.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm hover:border-[#7C3AED]/40 hover:shadow-subtle transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-50 font-mono text-xs font-bold text-[#7C3AED]">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-slate-900">{node.label}</span>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Type: <span className="text-[#7C3AED] font-semibold">{node.type}</span> • ID: {node.id}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveNode(node.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        title="Delete resource"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right: Live Terraform Code Editor (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-subtle">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-900">main.tf (HCL)</span>
                {loadingTf && <LoadingSpinner size="sm" />}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyTf}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                  title="Copy HCL code"
                >
                  {copiedTf ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  {copiedTf ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={handleDownloadTf}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                  title="Download .tf"
                >
                  <Download className="h-3 w-3" />
                  .tf
                </button>
              </div>
            </div>

            {/* High-Contrast Code Box */}
            <pre className="h-[460px] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-mono text-[11px] leading-relaxed text-slate-200 shadow-inner">
              {tfAnalysis?.hcl_code || '# Synthesizing Terraform code...'}
            </pre>
          </div>
        </div>
      </div>

      {/* Plan & Apply Modal */}
      <Modal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title="Terraform Plan & Apply Dry-Run"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Simulating HashiCorp Terraform execution against target cloud provider in environment: <span className="font-bold text-slate-900">{environment}</span>.
          </p>

          {applyLoading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3">
              <LoadingSpinner size="lg" />
              <p className="text-xs text-slate-500">Generating execution plan & locking state...</p>
            </div>
          ) : (
            applyResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3.5 border border-emerald-200 text-xs text-emerald-800 font-medium">
                  <span>Plan Status: <strong>{applyResult.plan_status}</strong></span>
                  <span>Duration: {applyResult.duration_seconds}s</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200">
                    <span className="text-emerald-700 font-bold block text-sm">+{applyResult.resources_to_add}</span>
                    <span className="text-slate-500">To Add</span>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200">
                    <span className="text-amber-700 font-bold block text-sm">~{applyResult.resources_to_change}</span>
                    <span className="text-slate-500">To Change</span>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200">
                    <span className="text-rose-700 font-bold block text-sm">-{applyResult.resources_to_destroy}</span>
                    <span className="text-slate-500">To Destroy</span>
                  </div>
                </div>

                <pre className="h-44 overflow-y-auto rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-slate-200 border border-slate-800 whitespace-pre-wrap">
                  {applyResult.output}
                </pre>
              </div>
            )
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" size="sm" onClick={() => setIsApplyModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
