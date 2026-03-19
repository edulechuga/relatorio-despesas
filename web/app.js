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

        console.log("Payload montado para o Backend (Camada 3):", payload);

        // Simulando a chamada para o backend em Python (app.py a ser feito posteriormente)
        setTimeout(() => {
            btn.classList.remove('loading');
            
            // Simula resultado
            mensagemBox.textContent = `Despesa de KM para "${clientes}" processada! (Simulação de Envio)`;
            mensagemBox.className = 'message success';
            
            form.reset();
            // Reseta toggle
            if(modoCalculo.checked) modoCalculo.click();
            
            setTimeout(() => {
                mensagemBox.classList.add('hidden');
            }, 5000);
            
        }, 1500);
        
    });
});
