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
            // Clear existing rows
            tableBody.innerHTML = '';
            tableBody.style.opacity = '1';

            let totalGeralValor = 0;
            let totalGeralQuantidade = 0;

            // Calculate totals first for percentage
            data.dados.forEach(item => {
                totalGeralValor += parseFloat(item.total || 0);
                totalGeralQuantidade += parseInt(item.quantidade || 0);
            });

            if (viewMode === 'completa') {
                const thDataCol = document.getElementById('th-data-col');
                const tfColspan = document.getElementById('tf-colspan');
                if(thDataCol) thDataCol.style.display = '';
                if(tfColspan) tfColspan.setAttribute('colspan', '4');

                data.dados.forEach(item => {
                    const row = tableBody.insertRow();

                    const cellToggle = row.insertCell(0); // empty
                    const cellData = row.insertCell(1);
                    cellData.textContent = item.data || '-';
                    cellData.style.color = 'var(--text-muted)';
                    cellData.style.fontSize = '0.8rem';

                    const cellCategoria = row.insertCell(2);
                    cellCategoria.textContent = item.categoria || 'Sem Categoria';

                    const cellDescricao = row.insertCell(3);
                    cellDescricao.textContent = item.descricao || 'Sem Descrição';

                    const cellTotal = row.insertCell(4);
                    const totalItem = parseFloat(item.total || 0);
                    cellTotal.textContent = totalItem.toFixed(2);

                    const cellPerc = row.insertCell(5);
                    const perc = totalGeralValor > 0 ? (totalItem / totalGeralValor * 100) : 0;
                    cellPerc.textContent = perc.toFixed(2) + '%';

                    const cellQuantidade = row.insertCell(6);
                    cellQuantidade.textContent = item.quantidade;

                    const cellMedia = row.insertCell(7);
                    cellMedia.textContent = parseFloat(item.media || 0).toFixed(2);
                });
            } else {
                // Modo Parcial
                const thDataCol = document.getElementById('th-data-col');
                const tfColspan = document.getElementById('tf-colspan');
                if(thDataCol) thDataCol.style.display = 'none';
                if(tfColspan) tfColspan.setAttribute('colspan', '3');

                const categoriasMap = {};
                data.dados.forEach(item => {
                    const cat = item.categoria || 'Sem Categoria';
                    if (!categoriasMap[cat]) {
                        categoriasMap[cat] = { categoria: cat, total: 0, quantidade: 0, items: [] };
                    }
                    categoriasMap[cat].total += parseFloat(item.total || 0);
                    categoriasMap[cat].quantidade += parseInt(item.quantidade || 0);
                    categoriasMap[cat].items.push(item);
                });

                Object.values(categoriasMap).forEach((catData, index) => {
                    // Parent row
                    const row = tableBody.insertRow();
                    row.style.backgroundColor = 'rgba(255,255,255,0.05)';
                    row.style.fontWeight = 'bold';
                    row.style.cursor = 'pointer';

                    const cellToggle = row.insertCell(0);
                    cellToggle.innerHTML = `<button class="toggle-btn" style="background:none; border:none; color:var(--text-main); cursor:pointer; padding:4px;"><i data-lucide="plus-square" style="width:18px; height:18px;"></i></button>`;
                    cellToggle.style.textAlign = 'center';

                    const cellCategoria = row.insertCell(1);
                    cellCategoria.textContent = catData.categoria;

                    const cellDescricao = row.insertCell(2);
                    cellDescricao.textContent = 'Várias';
                    cellDescricao.style.color = 'var(--text-muted)';
                    cellDescricao.style.fontWeight = 'normal';

                    const cellTotal = row.insertCell(3);
                    cellTotal.textContent = catData.total.toFixed(2);

                    const cellPerc = row.insertCell(4);
                    const perc = totalGeralValor > 0 ? (catData.total / totalGeralValor * 100) : 0;
                    cellPerc.textContent = perc.toFixed(2) + '%';

                    const cellQuantidade = row.insertCell(5);
                    cellQuantidade.textContent = catData.quantidade;

                    const cellMedia = row.insertCell(6);
                    cellMedia.textContent = (catData.quantidade > 0 ? catData.total / catData.quantidade : 0).toFixed(2);

                    // Child rows
                    const childRows = [];
                    // Aggregate items by descricao
                    const descMap = {};
                    catData.items.forEach(item => {
                        const desc = item.descricao || 'Sem Descrição';
                        if (!descMap[desc]) {
                            descMap[desc] = { descricao: desc, total: 0, quantidade: 0, media: 0 };
                        }
                        descMap[desc].total += parseFloat(item.total || 0);
                        descMap[desc].quantidade += parseInt(item.quantidade || 0);
                    });

                    Object.values(descMap).forEach(descItem => {
                        const childRow = tableBody.insertRow();
                        childRow.style.display = 'none'; // Hidden by default
                        
                        childRow.insertCell(0); // empty

                        const cCategoria = childRow.insertCell(1);
                        cCategoria.textContent = '';
                        
                        const cDescricao = childRow.insertCell(2);
                        cDescricao.textContent = descItem.descricao;
                        cDescricao.style.paddingLeft = '16px';
                        
                        const cTotal = childRow.insertCell(3);
                        cTotal.textContent = descItem.total.toFixed(2);
                        
                        const cPerc = childRow.insertCell(4);
                        const itemPerc = totalGeralValor > 0 ? (descItem.total / totalGeralValor * 100) : 0;
                        cPerc.textContent = itemPerc.toFixed(2) + '%';
                        
                        const cQuantidade = childRow.insertCell(5);
                        cQuantidade.textContent = descItem.quantidade;
                        
                        const cMedia = childRow.insertCell(6);
                        cMedia.textContent = (descItem.quantidade > 0 ? descItem.total / descItem.quantidade : 0).toFixed(2);
                        
                        childRows.push(childRow);
                    });

                    // Toggle logic
                    let expanded = false;
                    row.addEventListener('click', () => {
                        expanded = !expanded;
                        cellToggle.innerHTML = `<button class="toggle-btn" style="background:none; border:none; color:var(--text-main); cursor:pointer; padding:4px;"><i data-lucide="${expanded ? 'minus-square' : 'plus-square'}" style="width:18px; height:18px;"></i></button>`;
                        lucide.createIcons();
                        childRows.forEach(cr => {
                            cr.style.display = expanded ? '' : 'none';
                        });
                    });
                });
            }
            lucide.createIcons();

            // Update totals
            totalValor.textContent = totalGeralValor.toFixed(2);
            totalQuantidade.textContent = totalGeralQuantidade;

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
