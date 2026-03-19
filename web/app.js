// Lógica do Google Maps Autocomplete
let autocompletePartida, autocompleteDestino;

window.initMap = function() {
    console.log("Maps API Carregada");
    
    // Tenta inicializar apenas se as caixas de input existirem
    const inputPartida = document.getElementById('endPartida');
    const inputDestino = document.getElementById('endDestino');
    
    if(inputPartida && inputDestino) {
        // Se a chave for inválida (SUA_CHAVE_AQUI), ele vai dar erro de console, e limitará o UI.
        try {
            autocompletePartida = new google.maps.places.Autocomplete(inputPartida);
            autocompleteDestino = new google.maps.places.Autocomplete(inputDestino);
        } catch(e) {
            console.warn("Chave do maps inválida ou script não carregado corretamente ainda.", e);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const modoCalculo = document.getElementById('modoCalculo');
    const toggleText = document.getElementById('toggleText');
    const camposManuais = document.getElementById('camposManuais');
    const camposEndereco = document.getElementById('camposEndereco');
    const form = document.getElementById('kmForm');
    const btn = document.getElementById('submitBtn');
    const mensagemBox = document.getElementById('mensagem');
    
    // Toggle entre inputs manuais e endereços
    modoCalculo.addEventListener('change', (e) => {
        if (e.target.checked) {
            toggleText.textContent = "Modo: API Google Maps";
            camposManuais.classList.remove('active');
            camposEndereco.classList.add('active');
            
            // Remove required dos manuais
            document.getElementById('kmIda').removeAttribute('required');
            // Adiciona required nos enderecos
            document.getElementById('endPartida').setAttribute('required', 'true');
            document.getElementById('endDestino').setAttribute('required', 'true');
        } else {
            toggleText.textContent = "Modo: Inserção Manual da KM";
            camposEndereco.classList.remove('active');
            camposManuais.classList.add('active');
            
            // Remove required dos endereços
            document.getElementById('endPartida').removeAttribute('required');
            document.getElementById('endDestino').removeAttribute('required');
            // Adiciona required na ida
            document.getElementById('kmIda').setAttribute('required', 'true');
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // UI
        btn.classList.add('loading');
        mensagemBox.className = 'message hidden';
        
        const data = document.getElementById('data').value;
        const clientes = document.getElementById('clientes').value;
        const ufMaps = modoCalculo.checked;
        
        // Monta o Payload seguindo a diretriz: processar_km.md
        const payload = {
            data: data,
            clientes: clientes,
        };
        
        if (ufMaps) {
            payload.endereco_partida = document.getElementById('endPartida').value;
            payload.endereco_destino = document.getElementById('endDestino').value;
            // A diretriz pede km_ida obrigatório no backend (mesmo se vazio), mas faremos fallback no python.
            // Para não quebrar estrito, enviamos 0 se não preenchido.
            payload.km_ida = 0; 
        } else {
            payload.km_ida = document.getElementById('kmIda').value;
            payload.km_volta = document.getElementById('kmVolta').value || 0;
            payload.endereco_partida = "";
            payload.endereco_destino = "";
        }

        console.log("Payload montado para o Backend:", payload);

        // Comunicação REAL com a nossa API Flask/Gunicorn
        try {
            const response = await fetch('http://localhost:5000/api/km', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            btn.classList.remove('loading');
            
            if (response.ok) {
                mensagemBox.textContent = `Sucesso! Total calculado: R$ ${result.dados_sheets.Valor}`;
                mensagemBox.className = 'message success';
                form.reset();
                if(modoCalculo.checked) modoCalculo.click();
            } else {
                mensagemBox.textContent = `Erro: ${result.erro}`;
                mensagemBox.className = 'message error';
            }
        } catch (error) {
            btn.classList.remove('loading');
            mensagemBox.textContent = "Falha ao comunicar com o servidor. A API está rodando?";
            mensagemBox.className = 'message error';
        }
        
        setTimeout(() => {
            mensagemBox.classList.add('hidden');
        }, 8000);
        
    });
});
