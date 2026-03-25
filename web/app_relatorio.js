document.addEventListener('DOMContentLoaded', () => {
    carregarDashboard();
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
