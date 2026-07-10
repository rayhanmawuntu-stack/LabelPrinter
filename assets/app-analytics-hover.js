(function(){
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  window.lineChartHTML=function(buckets,key='chart'){
    const width=720,height=250,left=40,right=16,top=18,bottom=38;
    const innerW=width-left-right,innerH=height-top-bottom;
    const max=Math.max(1,...buckets.map(item=>Number(item.value)||0));
    const points=buckets.map((bucket,index)=>({
      ...bucket,
      value:Number(bucket.value)||0,
      x:left+(buckets.length===1?innerW/2:index*innerW/(buckets.length-1)),
      y:top+(1-(Number(bucket.value)||0)/max)*innerH
    }));
    const path=points.length?`M ${points.map(point=>`${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L ')}`:'';
    const area=points.length?`${path} L ${points[points.length-1].x.toFixed(1)} ${(top+innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(top+innerH).toFixed(1)} Z`:'';
    const gradient=`lineFill-${String(key).replace(/[^a-z0-9]/gi,'')}`;
    const grids=[0,.25,.5,.75,1].map(value=>{
      const y=top+innerH*value,label=Math.round(max*(1-value));
      return `<line class="line-grid" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text class="line-label y-label" x="${left-8}" y="${y+4}" text-anchor="end">${label}</text>`;
    }).join('');
    const axisLabels=points.map(point=>`<text class="line-label" x="${point.x}" y="${height-12}" text-anchor="middle">${esc(point.label)}</text>`).join('');
    const tooltipWidth=126,tooltipHeight=46;
    const hoverTargets=points.map((point,index)=>{
      const previous=index?points[index-1].x:left;
      const next=index<points.length-1?points[index+1].x:width-right;
      const hitLeft=index?(previous+point.x)/2:left;
      const hitRight=index<points.length-1?(point.x+next)/2:width-right;
      const tooltipX=clamp(point.x-tooltipWidth/2,left,width-right-tooltipWidth);
      const tooltipY=point.y<top+62?Math.min(top+innerH-tooltipHeight,point.y+14):point.y-tooltipHeight-12;
      const formatted=point.value.toLocaleString('en-GB');
      const valueLabel=`${formatted} label${point.value===1?'':'s'}`;
      const aria=`${point.label}: ${valueLabel}`;
      return `<g class="line-hover"><rect class="line-hit" x="${hitLeft}" y="${top}" width="${Math.max(1,hitRight-hitLeft)}" height="${innerH}" tabindex="0" focusable="true" role="img" aria-label="${esc(aria)}"><title>${esc(aria)}</title></rect><line class="line-guide" x1="${point.x}" y1="${top}" x2="${point.x}" y2="${top+innerH}"/><circle class="line-point-halo" cx="${point.x}" cy="${point.y}" r="10"/><circle class="line-point line-point-interactive" cx="${point.x}" cy="${point.y}" r="4"/><g class="line-tooltip" transform="translate(${tooltipX} ${tooltipY})"><rect class="line-tooltip-bg" width="${tooltipWidth}" height="${tooltipHeight}" rx="10"/><text class="line-tooltip-label" x="12" y="17">${esc(point.label)}</text><text class="line-tooltip-value" x="12" y="35">${esc(valueLabel)}</text></g></g>`;
    }).join('');
    return `<div class="line-chart interactive-line-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Labels generated over time"><defs><linearGradient id="${gradient}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#dfff3f" stop-opacity=".65"/><stop offset="100%" stop-color="#dfff3f" stop-opacity="0"/></linearGradient></defs>${grids}<path class="line-area" d="${area}" fill="url(#${gradient})"/><path class="line-path" d="${path}"/>${axisLabels}${hoverTargets}</svg></div>`;
  };
})();