document.addEventListener('DOMContentLoaded', () => {
    carregarDashboard();
    setupBreakdownModal();
});

const targetApi = `/api/relatorio`;

async function carregarDashboard() {
    const categorias = ['PESSOAL', 'CAJU', 'VIAGEM'];
    
    for (let c of categorias) {
        try {
            const res = await fetch(`${targetApi}/pendentes?tipo=${c}`);
            const data = await res.json();
            if (res.ok && data.dados) {
                let soma = 0.0;
                data.dados.forEach(d => {
                    soma += parseFloat(d.valor || 0);
                });
                
                // Formata os campos
                document.getElementById(`valor-${c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()}`).innerText = soma.toFixed(2);
                document.getElementById(`qtd-${c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()}`).innerText = data.dados.length;
            }
        } catch (e) {
            console.error("Erro ao puxar BD Pendente", e);
        }
    }
}

async function gerarRelatorio(tipo) {
    const loadDiv = document.getElementById('loading');
    const msgDiv = document.getElementById('mensagem');
    const downloadsDiv = document.getElementById('downloads');
    
    // Mostra loading
    loadDiv.style.display = 'block';
    msgDiv.className = 'message hidden';
    downloadsDiv.style.display = 'none';

    try {
        const response = await fetch(`${targetApi}/gerar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: tipo })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            msgDiv.innerHTML = `✅ Relatório gerado com sucesso para ${tipo}! A pasta pendente foi Limpa.`;
            msgDiv.className = 'message success';
            
            // Link Excel
            const baseHost = ``;
            document.getElementById('link-excel').href = baseHost + result.excel_url;
            document.getElementById('link-excel').download = '';
            
            // Link PDF
            if (result.pdf_url) {
                const lnkPdf = document.getElementById('link-pdf');
                lnkPdf.style.display = 'inline-block';
                lnkPdf.href = baseHost + result.pdf_url;
                lnkPdf.download = '';
            } else {
                document.getElementById('link-pdf').style.display = 'none';
            }
            
            downloadsDiv.style.display = 'block';
            
            // Atualiza o dashboard já zerado
            carregarDashboard();
            
        } else {
            msgDiv.textContent = `❌ Erro do Servidor: ${result.erro}`;
            msgDiv.className = 'message error';
        }

    } catch (e) {
        msgDiv.textContent = `❌ Erro de conexão com o painel: ${e.message}`;
        msgDiv.className = 'message error';
    } finally {
        loadDiv.style.display = 'none';
    }
}

// Breakdown functionality
let currentTipo = null;
// --- START SORTING LOGIC ---
let bdRawData = [];
let bdTotalGeralValor = 0;
let bdTotalGeralQuantidade = 0;
let bdSortCol = 'data';
let bdSortDir = 'desc';
let bdViewMode = 'parcial';

function sortData(data, col, dir) {
    return data.sort((a, b) => {
        let valA, valB;
        if (col === 'data') {
            // Convert DD/MM/YYYY to YYYY-MM-DD for comparison
            valA = a.data ? a.data.split('/').reverse().join('') : '';
            valB = b.data ? b.data.split('/').reverse().join('') : '';
        } else if (col === 'categoria') {
            valA = (a.categoria || '').toLowerCase();
            valB = (b.categoria || '').toLowerCase();
        } else if (col === 'descricao') {
            valA = (a.descricao || '').toLowerCase();
            valB = (b.descricao || '').toLowerCase();
        } else if (col === 'total') {
            valA = parseFloat(a.total || 0);
            valB = parseFloat(b.total || 0);
        } else if (col === 'perc') {
            valA = bdTotalGeralValor > 0 ? (parseFloat(a.total || 0) / bdTotalGeralValor) : 0;
            valB = bdTotalGeralValor > 0 ? (parseFloat(b.total || 0) / bdTotalGeralValor) : 0;
        } else if (col === 'quantidade') {
            valA = parseInt(a.quantidade || 0);
            valB = parseInt(b.quantidade || 0);
        } else if (col === 'media') {
            const qa = parseInt(a.quantidade || 0);
            const qb = parseInt(b.quantidade || 0);
            valA = qa > 0 ? parseFloat(a.total || 0) / qa : 0;
            valB = qb > 0 ? parseFloat(b.total || 0) / qb : 0;
        }

        if (valA < valB) return dir === 'asc' ? -1 : 1;
        if (valA > valB) return dir === 'asc' ? 1 : -1;
        return 0;
    });
}

function updateSortIcons() {
    const cols = ['data', 'categoria', 'descricao', 'total', 'perc', 'quantidade', 'media'];
    cols.forEach(c => {
        const iconEl = document.getElementById(`sort-icon-${c}`);
        if (iconEl) {
            if (c === bdSortCol) {
                iconEl.textContent = bdSortDir === 'asc' ? '▲' : '▼';
            } else {
                iconEl.textContent = '';
            }
        }
    });
}

window.handleSort = function(col) {
    if (bdSortCol === col) {
        bdSortDir = bdSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        bdSortCol = col;
        bdSortDir = 'desc';
    }
    updateSortIcons();
    renderBreakdownTable();
};

function renderBreakdownTable() {
    const tableBody = document.getElementById('breakdownTable').getElementsByTagName('tbody')[0];
    const totalValor = document.getElementById('breakdownTotalValor');
    const totalQuantidade = document.getElementById('breakdownTotalQuantidade');
    tableBody.innerHTML = '';
    
    if (bdRawData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Nenhum dado encontrado</td></tr>`;
        return;
    }

    if (bdViewMode === 'completa') {
        const thDataCol = document.getElementById('th-data-col');
        const tfColspan = document.getElementById('tf-colspan');
        if(thDataCol) thDataCol.style.display = '';
        if(tfColspan) tfColspan.setAttribute('colspan', '4');

        const sortedData = sortData([...bdRawData], bdSortCol, bdSortDir);

        sortedData.forEach(item => {
            const row = tableBody.insertRow();
            row.insertCell(0); // empty
            
            const cellData = row.insertCell(1);
            cellData.textContent = item.data || '-';
            cellData.style.color = 'var(--text-muted)';
            cellData.style.fontSize = '0.8rem';

            row.insertCell(2).textContent = item.categoria || 'Sem Categoria';
            row.insertCell(3).textContent = item.descricao || 'Sem Descrição';
            
            const totalItem = parseFloat(item.total || 0);
            row.insertCell(4).textContent = totalItem.toFixed(2);
            
            const perc = bdTotalGeralValor > 0 ? (totalItem / bdTotalGeralValor * 100) : 0;
            row.insertCell(5).textContent = perc.toFixed(2) + '%';
            
            row.insertCell(6).textContent = item.quantidade;
            row.insertCell(7).textContent = parseFloat(item.media || 0).toFixed(2);
        });
    } else {
        // Parcial Mode
        const thDataCol = document.getElementById('th-data-col');
        const tfColspan = document.getElementById('tf-colspan');
        if(thDataCol) thDataCol.style.display = 'none';
        if(tfColspan) tfColspan.setAttribute('colspan', '3');

        // Group by category first
        const categoriasMap = {};
        bdRawData.forEach(item => {
            const cat = item.categoria || 'Sem Categoria';
            if (!categoriasMap[cat]) {
                categoriasMap[cat] = { categoria: cat, total: 0, quantidade: 0, items: [] };
            }
            categoriasMap[cat].total += parseFloat(item.total || 0);
            categoriasMap[cat].quantidade += parseInt(item.quantidade || 0);
            categoriasMap[cat].items.push(item);
        });

        // Convert to array and sort parent categories
        let parentArray = Object.values(categoriasMap);
        parentArray = sortData(parentArray, bdSortCol, bdSortDir);

        parentArray.forEach((catData) => {
            const row = tableBody.insertRow();
            row.style.backgroundColor = 'rgba(255,255,255,0.05)';
            row.style.fontWeight = 'bold';
            row.style.cursor = 'pointer';

            const cellToggle = row.insertCell(0);
            cellToggle.innerHTML = `<button class="toggle-btn" style="background:none; border:none; color:var(--text-main); cursor:pointer; padding:4px;"><i data-lucide="plus-square" style="width:18px; height:18px;"></i></button>`;
            cellToggle.style.textAlign = 'center';

            row.insertCell(1).textContent = catData.categoria;
            
            const cellDescricao = row.insertCell(2);
            cellDescricao.textContent = 'Várias';
            cellDescricao.style.color = 'var(--text-muted)';
            cellDescricao.style.fontWeight = 'normal';

            row.insertCell(3).textContent = catData.total.toFixed(2);
            
            const perc = bdTotalGeralValor > 0 ? (catData.total / bdTotalGeralValor * 100) : 0;
            row.insertCell(4).textContent = perc.toFixed(2) + '%';
            
            row.insertCell(5).textContent = catData.quantidade;
            row.insertCell(6).textContent = (catData.quantidade > 0 ? catData.total / catData.quantidade : 0).toFixed(2);

            const childRows = [];
            
            // Group items by description
            const descMap = {};
            catData.items.forEach(item => {
                const desc = item.descricao || 'Sem Descrição';
                if (!descMap[desc]) {
                    descMap[desc] = { descricao: desc, total: 0, quantidade: 0 };
                }
                descMap[desc].total += parseFloat(item.total || 0);
                descMap[desc].quantidade += parseInt(item.quantidade || 0);
            });

            let childArray = Object.values(descMap);
            childArray = sortData(childArray, bdSortCol, bdSortDir);

            childArray.forEach(descItem => {
                const childRow = tableBody.insertRow();
                childRow.style.display = 'none';
                
                childRow.insertCell(0);
                childRow.insertCell(1).textContent = '';
                
                const cDesc = childRow.insertCell(2);
                cDesc.textContent = descItem.descricao;
                cDesc.style.paddingLeft = '16px';
                
                childRow.insertCell(3).textContent = descItem.total.toFixed(2);
                
                const itemPerc = bdTotalGeralValor > 0 ? (descItem.total / bdTotalGeralValor * 100) : 0;
                childRow.insertCell(4).textContent = itemPerc.toFixed(2) + '%';
                
                childRow.insertCell(5).textContent = descItem.quantidade;
                childRow.insertCell(6).textContent = (descItem.quantidade > 0 ? descItem.total / descItem.quantidade : 0).toFixed(2);
                
                childRows.push(childRow);
            });

            let expanded = false;
            row.addEventListener('click', () => {
                expanded = !expanded;
                cellToggle.innerHTML = `<button class="toggle-btn" style="background:none; border:none; color:var(--text-main); cursor:pointer; padding:4px;"><i data-lucide="${expanded ? 'minus-square' : 'plus-square'}" style="width:18px; height:18px;"></i></button>`;
                lucide.createIcons();
                childRows.forEach(cr => cr.style.display = expanded ? '' : 'none');
            });
        });
    }

    lucide.createIcons();
    totalValor.textContent = bdTotalGeralValor.toFixed(2);
    totalQuantidade.textContent = bdTotalGeralQuantidade;
}
// --- END SORTING LOGIC ---



async function mostrarBreakdown(tipo, forceViewMode = null) {
    currentTipo = tipo;
    const loadingDiv = document.getElementById('breakdownLoading');
    const contentDiv = document.getElementById('breakdownContent');
    const modalTitle = document.getElementById('modalTitle');
    const tableBody = document.getElementById('breakdownTable').getElementsByTagName('tbody')[0];
    const totalValor = document.getElementById('breakdownTotalValor');
    const totalQuantidade = document.getElementById('breakdownTotalQuantidade');
    const viewMode = forceViewMode || document.querySelector('input[name="breakdownGroup"]:checked').value;

    // Update modal title preserving the icon
    modalTitle.innerHTML = `<i data-lucide="layout-dashboard" style="width: 24px; height: 24px;"></i> Breakdown de Gastos - ${tipo}`;
    lucide.createIcons(); // Re-render icon

    // Show loading
    if (!forceViewMode) {
        // Only hide content completely on first load
        contentDiv.style.display = 'none';
        loadingDiv.style.display = 'block';
    } else {
        // Just fade table when switching groups
        tableBody.style.opacity = '0.5';
    }

    // Show modal
    document.getElementById('breakdownModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    try {
        const response = await fetch(`${targetApi}/breakdown?tipo=${tipo}&groupby=categoria,descricao`);
        const data = await response.json();

        if (response.ok && data.dados) {

            bdRawData = data.dados;
            bdTotalGeralValor = 0;
            bdTotalGeralQuantidade = 0;
            bdRawData.forEach(item => {
                bdTotalGeralValor += parseFloat(item.total || 0);
                bdTotalGeralQuantidade += parseInt(item.quantidade || 0);
            });
            bdViewMode = viewMode;
            renderBreakdownTable();
            updateSortIcons();

            tableBody.style.opacity = '1';
            // Hide loading, show content
            loadingDiv.style.display = 'none';
            contentDiv.style.display = 'block';
        } else {
            loadingDiv.style.display = 'none';
            contentDiv.style.display = 'block';
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Erro ao carregar dados: ${data.erro || 'Erro desconhecido'}</td></tr>`;
            totalValor.textContent = '0.00';
            totalQuantidade.textContent = '0';
        }

    } catch (e) {
        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Erro de conexão: ${e.message}</td></tr>`;
        totalValor.textContent = '0.00';
        totalQuantidade.textContent = '0';
        console.error("Erro ao buscar breakdown:", e);
    }
}

function setupBreakdownModal() {
    const modal = document.getElementById('breakdownModal');
    const closeBtn = document.getElementById('breakdownCloseModal');
    const exportBtn = document.getElementById('breakdownExportBtn');
    const generateReportBtn = document.getElementById('breakdownGenerateReportBtn');

    // Close modal
    function fecharModal() {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    if (closeBtn) closeBtn.addEventListener('click', fecharModal);

    // Close when clicking outside modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            fecharModal();
        }
    });

    // Grouping toggle
    const groupRadios = document.querySelectorAll('input[name="breakdownGroup"]');
    groupRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (currentTipo) {
                mostrarBreakdown(currentTipo, e.target.value);
            }
        });
    });

    // Export breakdown
    exportBtn.addEventListener('click', async () => {
        if (!currentTipo) return;
        const exportGroupby = 'categoria,descricao';

        try {
            const response = await fetch(`${targetApi}/breakdown?tipo=${currentTipo}&groupby=${exportGroupby}`);
            if (response.ok) {
                const result = await response.json();
                let csvContent = "data:text/csv;charset=utf-8,";
                csvContent += "Data,Categoria,Descricao,Total,Quantidade,Media\n";
                result.dados.forEach(item => {
                    const dt = item.data || '';
                    const cat = item.categoria || 'Sem Categoria';
                    const desc = item.descricao || 'Sem Descrição';
                    const tot = parseFloat(item.total || 0).toFixed(2);
                    const qtd = item.quantidade || 0;
                    const med = parseFloat(item.media || 0).toFixed(2);
                    csvContent += `"${dt}","${cat}","${desc}",${tot},${qtd},${med}\r\n`;
                });
                const encodedUri = encodeURI(csvContent);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = encodedUri;
                a.download = `breakdown_${currentTipo}_${new Date().toISOString().slice(0,10)}.csv`;
                document.body.appendChild(a);
                a.click();
            } else {
                const error = await response.json();
                alert(`Erro ao exportar: ${error.erro}`);
            }
        } catch (e) {
            alert(`Erro de conexão: ${e.message}`);
        }
    });

    // Generate report (traditional)
    generateReportBtn.addEventListener('click', () => {
        fecharModal(); // Close breakdown modal first
        gerarRelatorio(currentTipo); // Then generate report
    });
}

// Override the original gerarRelatorio function calls in HTML to show breakdown instead
// We'll do this by modifying the onclick attributes or by replacing the function globally
// Since the HTML uses inline onclick, we need to modify those or create a wrapper
// Let's create a wrapper function that will be used by the HTML
window.gerarRelatorioComBreakdown = function(tipo) {
    const groupResumida = document.getElementById('group-resumida');
    if (groupResumida) groupResumida.checked = true;
    mostrarBreakdown(tipo, 'parcial');
};
