import { useState, useMemo } from "react";
import { BacklinkSource } from "../types";
import { 
  ExternalLink, Globe,
  RefreshCw, SlidersHorizontal, Zap, Sparkles, Check, Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BacklinkNetworkGraphProps {
  backlinkSources: BacklinkSource[];
  targetDomain: string;
  targetRating: number;
  competitorDomain: string;
  competitorRating: number;
  onSimulateRatingChange?: (newRating: number) => void;
}

interface Node {
  id: string;
  label: string;
  type: "target" | "competitor" | "referrer";
  rating: number;
  x: number;
  y: number;
  fx?: number;
  fy?: number;
  originalData?: BacklinkSource;
}

interface LinkEdge {
  source: string;
  target: string;
  type: "competitor-link" | "target-link" | "simulated-link";
  linkType?: string;
  anchorText?: string;
}

export default function BacklinkNetworkGraph({
  backlinkSources: sourcesProp,
  targetDomain,
  targetRating,
  competitorDomain,
  competitorRating,
  onSimulateRatingChange
}: BacklinkNetworkGraphProps) {
  const backlinkSources = Array.isArray(sourcesProp) ? sourcesProp : [];
  // Filters
  const [minDR, setMinDR] = useState<number>(0);
  const [followOnly, setFollowOnly] = useState<boolean>(false);
  
  // Simulated bridged backlinks
  const [bridgedUrls, setBridgedUrls] = useState<Set<string>>(new Set());
  
  // Selected node for inspector
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Hovered node
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Layout mode
  const [layoutMode, setLayoutMode] = useState<"cluster" | "split" | "radial">("cluster");

  // Reset simulation
  const handleReset = () => {
    setBridgedUrls(new Set());
    setSelectedNodeId(null);
    if (onSimulateRatingChange) {
      onSimulateRatingChange(targetRating);
    }
  };

  // Toggle bridge status
  const toggleBridge = (sourceUrl: string) => {
    const newBridged = new Set(bridgedUrls);
    if (newBridged.has(sourceUrl)) {
      newBridged.delete(sourceUrl);
    } else {
      newBridged.add(sourceUrl);
    }
    setBridgedUrls(newBridged);

    // Recalculate rating: Each bridged link boosts rating based on its domain authority
    if (onSimulateRatingChange) {
      let boost = 0;
      backlinkSources.forEach(src => {
        if (newBridged.has(src.sourceUrl)) {
          // DR 80+ gives +4, 60+ gives +3, others +1 or +2
          if (src.domainRating >= 80) boost += 4.5;
          else if (src.domainRating >= 60) boost += 3;
          else if (src.domainRating >= 40) boost += 2;
          else boost += 1;
        }
      });
      const finalRating = Math.min(100, Math.round(targetRating + boost));
      onSimulateRatingChange(finalRating);
    }
  };

  // Filter sources
  const filteredSources = useMemo(() => {
    return backlinkSources.filter(src => {
      if (src.domainRating < minDR) return false;
      if (followOnly && src.linkType !== "Follow") return false;
      return true;
    });
  }, [backlinkSources, minDR, followOnly]);

  // Generate nodes and edges geometrically
  const { nodes, edges } = useMemo(() => {
    const computedNodes: Node[] = [];
    const computedEdges: LinkEdge[] = [];

    // Canvas size: 800 x 480
    const centerX = 400;
    const centerY = 240;

    // Define positions of primary targets based on layoutMode
    let targetPos = { x: 200, y: centerY };
    let competitorPos = { x: 600, y: centerY };

    if (layoutMode === "cluster") {
      targetPos = { x: 260, y: centerY };
      competitorPos = { x: 540, y: centerY };
    } else if (layoutMode === "split") {
      targetPos = { x: 180, y: centerY };
      competitorPos = { x: 620, y: centerY };
    } else if (layoutMode === "radial") {
      targetPos = { x: centerX, y: centerY };
      // Competitor is close but offset
      competitorPos = { x: centerX + 180, y: centerY - 100 };
    }

    // Add target node
    computedNodes.push({
      id: "target-node",
      label: targetDomain,
      type: "target",
      rating: targetRating,
      x: targetPos.x,
      y: targetPos.y
    });

    // Add competitor node
    computedNodes.push({
      id: "competitor-node",
      label: competitorDomain,
      type: "competitor",
      rating: competitorRating,
      x: competitorPos.x,
      y: competitorPos.y
    });

    // Add satellite nodes (the referring domains)
    const count = filteredSources.length;
    filteredSources.forEach((src, idx) => {
      const srcDomain = src.sourceUrl.replace("https://", "").split("/")[0];
      
      let nodeX = 0;
      let nodeY = 0;

      if (layoutMode === "cluster") {
        // Position them in an arc clustered mostly around the competitor (since they currently refer to it)
        const angle = -Math.PI / 2 + (idx / (count - 1 || 1)) * Math.PI; // Semisemicircle arc around competitor
        const radius = 130 + (idx % 2 === 0 ? 15 : -15);
        nodeX = competitorPos.x + Math.cos(angle) * radius;
        nodeY = competitorPos.y + Math.sin(angle) * radius;
      } else if (layoutMode === "split") {
        // Position them in a vertical column between target and competitor, or distributed randomly
        const fraction = idx / (count || 1);
        const colY = 80 + fraction * 320;
        const colX = centerX + (idx % 2 === 0 ? 30 : -30);
        nodeX = colX;
        nodeY = colY;
      } else {
        // Radial: Position in a circular orbit around both
        const angle = (idx * (2 * Math.PI)) / (count || 1);
        const radius = 170;
        nodeX = centerX + Math.cos(angle) * radius;
        nodeY = centerY + Math.sin(angle) * radius;
      }

      // Constrain coordinates within safe bounds
      nodeX = Math.max(50, Math.min(750, nodeX));
      nodeY = Math.max(50, Math.min(430, nodeY));

      computedNodes.push({
        id: src.sourceUrl,
        label: srcDomain,
        type: "referrer",
        rating: src.domainRating,
        x: nodeX,
        y: nodeY,
        originalData: src
      });

      // Edge from referring site to competitor (current real-world connection)
      computedEdges.push({
        source: src.sourceUrl,
        target: "competitor-node",
        type: "competitor-link",
        linkType: src.linkType,
        anchorText: src.anchorText
      });

      // Edge from referring site to target (if simulated/bridged)
      if (bridgedUrls.has(src.sourceUrl)) {
        computedEdges.push({
          source: src.sourceUrl,
          target: "target-node",
          type: "simulated-link",
          linkType: "Follow",
          anchorText: "Simulated Strategic Bridge"
        });
      }
    });

    return { nodes: computedNodes, edges: computedEdges };
  }, [filteredSources, targetDomain, targetRating, competitorDomain, competitorRating, layoutMode, bridgedUrls]);

  // Selected node data for inspector
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header Controls */}
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-500 text-white rounded-lg">
              <Sparkles className="h-4.5 w-4.5 animate-pulse" />
            </span>
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Interactive Backlink Relationship Graph
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Click nodes to explore existing references. Click <strong className="text-emerald-600 font-semibold">"Bridge Link"</strong> to simulate acquisition and watch authority increase.
          </p>
        </div>

        {/* Control actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Layout buttons */}
          <div className="flex items-center rounded-lg bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setLayoutMode("cluster")}
              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                layoutMode === "cluster" ? "bg-white text-slate-800 shadow-xs" : "text-slate-400 hover:text-slate-700"
              }`}
              title="Competitor Clustered"
            >
              Cluster
            </button>
            <button
              onClick={() => setLayoutMode("split")}
              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                layoutMode === "split" ? "bg-white text-slate-800 shadow-xs" : "text-slate-400 hover:text-slate-700"
              }`}
              title="Split Comparison"
            >
              Split
            </button>
            <button
              onClick={() => setLayoutMode("radial")}
              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                layoutMode === "radial" ? "bg-white text-slate-800 shadow-xs" : "text-slate-400 hover:text-slate-700"
              }`}
              title="Radial Orbit"
            >
              Orbit
            </button>
          </div>

          {bridgedUrls.size > 0 && (
            <button
              onClick={handleReset}
              className="px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Reset simulation ({bridgedUrls.size})
            </button>
          )}
        </div>
      </div>

      {/* Grid: Graph Viewport (left) + Detail Panel (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 border-b border-slate-100">
        
        {/* SVG Network Canvas (8 Columns) */}
        <div className="lg:col-span-8 p-4 relative bg-slate-50/30 flex items-center justify-center min-h-[440px] select-none">
          
          {/* Grid Background Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:24px_24px] opacity-60 pointer-events-none" />

          {/* Canvas Wrapper */}
          <svg 
            viewBox="0 0 800 480" 
            className="w-full h-auto max-w-[800px] z-10 filter drop-shadow-xs"
          >
            <defs>
              {/* Arrowheads */}
              <marker
                id="arrow-competitor"
                viewBox="0 0 10 10"
                refX="22"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#cbd5e1" />
              </marker>

              <marker
                id="arrow-target"
                viewBox="0 0 10 10"
                refX="22"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
              </marker>

              {/* Glowing effects */}
              <filter id="glow-target" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              <filter id="glow-simulated" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* EDGES (LINES) */}
            <g>
              {edges.map((edge, idx) => {
                const sourceNode = nodes.find(n => n.id === edge.source);
                const targetNode = nodes.find(n => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                const isHovered = hoveredNodeId === edge.source || hoveredNodeId === edge.target;
                const isSelected = selectedNodeId === edge.source || selectedNodeId === edge.target;
                
                // Draw bezier curved lines instead of straight lines to look super premium
                const dx = targetNode.x - sourceNode.x;
                const dy = targetNode.y - sourceNode.y;
                const dr = Math.max(1, Math.sqrt(dx * dx + dy * dy) * (edge.type === "simulated-link" ? 1.4 : 1.2));
                
                const sweep = edge.type === "simulated-link" ? 0 : 1;
                const pathD = `M${sourceNode.x},${sourceNode.y} A${dr},${dr} 0 0,${sweep} ${targetNode.x},${targetNode.y}`;

                let strokeColor = "#e2e8f0";
                let strokeWidth = 1.5;
                let strokeDasharray = undefined;
                let markerId = "arrow-competitor";

                if (edge.type === "competitor-link") {
                  strokeColor = isSelected ? "#3b82f6" : isHovered ? "#94a3b8" : "#cbd5e1";
                  strokeWidth = isSelected ? 2.5 : isHovered ? 2 : 1.5;
                  if (edge.linkType === "Nofollow") {
                    strokeDasharray = "4 4";
                  }
                } else if (edge.type === "simulated-link") {
                  strokeColor = "#10b981";
                  strokeWidth = isSelected ? 3 : isHovered ? 2.5 : 2;
                  markerId = "arrow-target";
                }

                return (
                  <g key={`edge-${idx}`} className="transition-all duration-300">
                    {/* Invisible thicker line for easier hovering */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={12}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredNodeId(edge.source)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                    />

                    {/* Visible line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDasharray}
                      markerEnd={`url(#${markerId})`}
                      className="transition-all duration-300"
                      filter={edge.type === "simulated-link" ? "url(#glow-simulated)" : undefined}
                    />

                    {/* Animated moving trust dots along the simulated links */}
                    {edge.type === "simulated-link" && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#6ee7b7"
                        strokeWidth={3}
                        strokeDasharray="8 20"
                        className="animate-[dash_2s_linear_infinite]"
                        style={{
                          strokeDashoffset: 100,
                        }}
                      />
                    )}
                  </g>
                );
              })}
            </g>

            {/* NODES (CIRCLES) */}
            <g>
              {nodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const isHovered = hoveredNodeId === node.id;
                const isRelated = hoveredNodeId 
                  ? edges.some(e => (e.source === node.id && e.target === hoveredNodeId) || (e.target === node.id && e.source === hoveredNodeId) || node.id === hoveredNodeId)
                  : true;

                // Configure node styling depending on type
                let radius = 14;
                let fill = "#fff";
                let stroke = "#94a3b8";
                let strokeWidth = 2;
                let labelColor = "text-slate-600";

                if (node.type === "target") {
                  radius = 32;
                  fill = "#2563eb";
                  stroke = "#60a5fa";
                  strokeWidth = 3;
                  labelColor = "text-blue-900 font-bold";
                } else if (node.type === "competitor") {
                  radius = 30;
                  fill = "#475569";
                  stroke = "#94a3b8";
                  strokeWidth = 3;
                  labelColor = "text-slate-800 font-bold";
                } else if (node.type === "referrer") {
                  // Size according to domain rating
                  radius = 12 + Math.min(10, (node.rating / 10));
                  
                  const isBridged = bridgedUrls.has(node.id);
                  if (isBridged) {
                    fill = "#10b981";
                    stroke = "#34d399";
                    strokeWidth = 2.5;
                  } else {
                    fill = "#ffffff";
                    stroke = node.rating >= 80 ? "#2563eb" : node.rating >= 60 ? "#3b82f6" : "#94a3b8";
                    strokeWidth = node.rating >= 70 ? 2.5 : 1.5;
                  }
                }

                return (
                  <g 
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className="cursor-pointer select-none"
                    onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    style={{
                      opacity: isRelated ? 1 : 0.25,
                      transition: "opacity 0.3s ease, transform 0.2s ease"
                    }}
                  >
                    {/* Pulsing halo ring for Target Node or selected nodes */}
                    {node.type === "target" && (
                      <circle
                        r={radius + 12}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth={1.5}
                        className="animate-ping opacity-25"
                      />
                    )}

                    {/* Outer Border Selection Circle */}
                    <circle
                      r={radius + (isSelected ? 6 : isHovered ? 4 : 0)}
                      fill="none"
                      stroke={node.type === "target" ? "#2563eb" : node.type === "competitor" ? "#475569" : stroke}
                      strokeWidth={1.5}
                      strokeDasharray={isSelected ? "3 2" : undefined}
                      className="transition-all duration-200"
                    />

                    {/* Core Solid Node */}
                    <circle
                      r={radius}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      filter={node.type === "target" ? "url(#glow-target)" : undefined}
                      className="transition-all duration-200"
                    />

                    {/* Node rating overlay (centered badge) */}
                    {node.type !== "target" && node.type !== "competitor" && (
                      <text
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        fontSize={8}
                        fontWeight={800}
                        fill={bridgedUrls.has(node.id) ? "#ffffff" : "#1e293b"}
                        className="font-mono pointer-events-none"
                      >
                        {node.rating}
                      </text>
                    )}

                    {/* Target/Competitor text overlays inside */}
                    {node.type === "target" && (
                      <g className="pointer-events-none">
                        <text
                          textAnchor="middle"
                          alignmentBaseline="middle"
                          fontSize={10}
                          fontWeight={900}
                          fill="#ffffff"
                          dy="-4"
                          className="font-sans"
                        >
                          YOU
                        </text>
                        <text
                          textAnchor="middle"
                          alignmentBaseline="middle"
                          fontSize={9}
                          fontWeight={800}
                          fill="#93c5fd"
                          dy="8"
                          className="font-mono"
                        >
                          DR {node.rating}
                        </text>
                      </g>
                    )}

                    {node.type === "competitor" && (
                      <g className="pointer-events-none">
                        <text
                          textAnchor="middle"
                          alignmentBaseline="middle"
                          fontSize={10}
                          fontWeight={900}
                          fill="#ffffff"
                          dy="-4"
                          className="font-sans"
                        >
                          COMP
                        </text>
                        <text
                          textAnchor="middle"
                          alignmentBaseline="middle"
                          fontSize={9}
                          fontWeight={800}
                          fill="#cbd5e1"
                          dy="8"
                          className="font-mono"
                        >
                          DR {node.rating}
                        </text>
                      </g>
                    )}

                    {/* Node Text Label Placement */}
                    <text
                      textAnchor="middle"
                      y={radius + (node.type === "referrer" ? 14 : 22)}
                      fontSize={10}
                      fontWeight={isSelected || isHovered ? 800 : 500}
                      className={`${labelColor} font-sans drop-shadow-sm pointer-events-none`}
                    >
                      {node.label.length > 22 ? node.label.substring(0, 20) + "..." : node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Interactive Floating Guide Legend */}
          <div className="absolute bottom-3 left-3 bg-white/95 p-2 rounded-xl border border-slate-200/80 shadow-xs text-[9px] font-sans space-y-1 z-10 hidden sm:block">
            <span className="font-bold text-slate-400 uppercase tracking-widest block text-[8px] mb-1">Graph Legend</span>
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-blue-400 block shrink-0" />
              <span>Target Website (You)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600 border border-slate-400 block shrink-0" />
              <span>Niche Competitor</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-blue-500 block shrink-0" />
              <span>High Authority Referring Site</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-300 block shrink-0" />
              <span>Bridged Backlink (Simulated)</span>
            </div>
          </div>
        </div>

        {/* Right Detail Inspector Panel (4 Columns) */}
        <div className="lg:col-span-4 bg-slate-50/50 p-5 border-t lg:border-t-0 lg:border-l border-slate-100 flex flex-col justify-between min-h-[440px]">
          <AnimatePresence mode="wait">
            {selectedNode ? (
              <motion.div
                key={selectedNode.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4 flex-1 flex flex-col justify-between"
              >
                {/* Node Metadata Card */}
                <div className="space-y-3.5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                        selectedNode.type === "target" 
                          ? "bg-blue-100 text-blue-700" 
                          : selectedNode.type === "competitor" 
                            ? "bg-slate-200 text-slate-700" 
                            : bridgedUrls.has(selectedNode.id)
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                      }`}>
                        {selectedNode.type === "target" 
                          ? "Target Domain" 
                          : selectedNode.type === "competitor" 
                            ? "Competitor Domain" 
                            : bridgedUrls.has(selectedNode.id)
                              ? "Bridged Partner"
                              : "Referring Domain"}
                      </span>
                      <h4 className="font-extrabold text-slate-900 text-sm break-all font-mono">
                        {selectedNode.label}
                      </h4>
                    </div>

                    {/* Domain rating badge */}
                    <div className="bg-white px-2 py-1.5 rounded-xl border border-slate-200 shadow-xs text-center min-w-12">
                      <span className="text-[8px] text-slate-400 font-bold uppercase block tracking-wider">DR</span>
                      <span className="font-mono font-extrabold text-sm text-slate-800">
                        {selectedNode.rating}
                      </span>
                    </div>
                  </div>

                  {selectedNode.originalData ? (
                    /* Detailed referring parameters */
                    <div className="space-y-3 pt-3 border-t border-slate-200/60 text-xs">
                      <div>
                        <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[9px] mb-1">
                          Anchor Text
                        </span>
                        <p className="bg-white p-2.5 rounded-xl border border-slate-100 italic text-slate-700 leading-normal">
                          "{selectedNode.originalData.anchorText}"
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                          <span className="text-slate-400 font-bold block text-[8px] uppercase tracking-wider">Link Relation</span>
                          <span className="font-mono text-slate-700 font-semibold">{selectedNode.originalData.linkType}</span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                          <span className="text-slate-400 font-bold block text-[8px] uppercase tracking-wider">Partner Strength</span>
                          <span className="font-semibold text-blue-600">
                            {selectedNode.rating >= 80 ? "Editorial Elite" : selectedNode.rating >= 60 ? "High Trust" : "Standard Authority"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[9px]">
                          Target URL Path
                        </span>
                        <a 
                          href={selectedNode.originalData.targetUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-mono text-[10px] text-slate-500 break-all hover:text-blue-600 hover:underline flex items-center gap-1 bg-white p-2 rounded-xl border border-slate-100"
                        >
                          <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{selectedNode.originalData.targetUrl.replace("https://", "")}</span>
                          <ExternalLink className="h-2.5 w-2.5 shrink-0 ml-auto" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    /* Target or Competitor general notes */
                    <div className="space-y-2 pt-2 border-t border-slate-200/60 text-xs text-slate-600 leading-relaxed">
                      {selectedNode.type === "target" ? (
                        <p>
                          Your core domain. This represents your search engine visibility baseline. Acquiring follow links from competitors' referring partners passes equity directly here, which shrinks the authority gap and elevates your organic keywords.
                        </p>
                      ) : (
                        <p>
                          Primary benchmark competitor in this workspace. These guys hold the top SERP ranks largely because of their referring profile (DR {competitorRating}). Replicating their follow link acquisitions is the fastest path to outranking them.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Node Actions */}
                {selectedNode.type === "referrer" && (
                  <div className="pt-5 border-t border-slate-200/60 mt-auto space-y-2">
                    <button
                      onClick={() => toggleBridge(selectedNode.id)}
                      className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 border ${
                        bridgedUrls.has(selectedNode.id)
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-xs"
                      }`}
                    >
                      {bridgedUrls.has(selectedNode.id) ? (
                        <>
                          <Check className="h-4 w-4" />
                          Link Bridged to Target
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          Bridge Link to Target (+{Math.round(selectedNode.rating / 15)} DR)
                        </>
                      )}
                    </button>
                    
                    <a
                      href={selectedNode.id}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-4 rounded-xl font-bold text-xs bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 transition-all flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Visit Referring Website
                    </a>
                  </div>
                )}
              </motion.div>
            ) : (
              /* No node selected initial instructions */
              <div className="h-full flex flex-col justify-center items-center text-center p-6 space-y-3">
                <div className="p-3 bg-slate-100 text-slate-400 rounded-full">
                  <Info className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Node Inspector</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1 max-w-[200px]">
                    Click any element in the link relationship graph to inspect authority metrics, anchors, and action items.
                  </p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Interactive Filter Controls */}
      <div className="px-5 py-4 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4 text-xs font-medium">
        <div className="flex flex-wrap items-center gap-6">
          {/* DR Slider Filter */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-500">Min Domain Rating (DR):</span>
            <input
              type="range"
              min="0"
              max="90"
              step="10"
              value={minDR}
              onChange={(e) => setMinDR(Number(e.target.value))}
              className="w-24 accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
            />
            <span className="font-mono font-bold text-slate-700 w-8">
              {minDR > 0 ? `DR ${minDR}+` : "All"}
            </span>
          </div>

          {/* Follow toggle filter */}
          <label className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-900 select-none">
            <input
              type="checkbox"
              checked={followOnly}
              onChange={(e) => setFollowOnly(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer accent-blue-600"
            />
            <span>Follow Links Only</span>
          </label>
        </div>

        {/* Dynamic Nodes Count Indicator */}
        <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
          Rendered: <span className="font-mono text-slate-600 font-extrabold">{nodes.length} Nodes</span> | <span className="font-mono text-slate-600 font-extrabold">{edges.length} Connections</span>
        </div>
      </div>
    </div>
  );
}
