// Lógica do Google Maps e Autocomplete
let map, directionsService, directionsRenderer;
let autocompletePartida, autocompleteDestino;

window.initMap = function() {
    console.log("Maps API Carregada");
    
    directionsService = new google.maps.DirectionsService();
    // Torna a rota alterável/arrastável
    directionsRenderer = new google.maps.DirectionsRenderer({
        draggable: true
    });
    
    // Inicia o mapa
    const mapCenter = { lat: -23.5505, lng: -46.6333 }; // São Paulo
    
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 10,
        center: mapCenter,
        disableDefaultUI: true, 
    });
    
    directionsRenderer.setMap(map);
    
    // Escuta evento de rota "arrastada" ou alterada pelo usuário
    directionsRenderer.addListener('directions_changed', function() {
        const directions = directionsRenderer.getDirections();
        if (directions) {
            atualizarDistanciaPelaRota(directions);
        }
    });
    
    // Anexa Autocomplete às caixas estáticas
    const inputPartida = document.getElementById('endPartida');
    const inputDestino = document.getElementById('endDestino');
    
    if(inputPartida && inputDestino) {
        try {
            autocompletePartida = new google.maps.places.Autocomplete(inputPartida);
            autocompleteDestino = new google.maps.places.Autocomplete(inputDestino);
            
            // Recalcula a rota
            autocompletePartida.addListener('place_changed', calculateAndDisplayRoute);
            autocompleteDestino.addListener('place_changed', calculateAndDisplayRoute);
            
            inputPartida.addEventListener('change', calculateAndDisplayRoute);
            inputDestino.addEventListener('change', calculateAndDisplayRoute);
        } catch(e) {
            console.warn("Chave do maps inválida ou script não carregado", e);
        }
    }
    
    // Botão Adicionar Parada
    const btnAddWaypoint = document.getElementById('btnAddWaypoint');
    if(btnAddWaypoint) {
        btnAddWaypoint.addEventListener('click', addWaypointInput);
    }
    
    // Checkbox Ida e Volta Maps
    const idaVoltaMaps = document.getElementById('idaVoltaMaps');
    if(idaVoltaMaps) {
        idaVoltaMaps.addEventListener('change', calculateAndDisplayRoute);
    }
}

// Global variable para armazenar a Km real extraída do mapa
let kmCalculadaOculta = 0;
let waypointCount = 0;

function addWaypointInput() {
    waypointCount++;
    const container = document.getElementById('waypointsContainer');
    
    const div = document.createElement('div');
    div.className = 'form-group';
    div.style.marginBottom = '10px';
    
    const label = document.createElement('label');
    label.innerText = `Parada ${waypointCount}`;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'waypoint-input';
    input.placeholder = 'Digite um endereço de parada intermediária...';
    
    div.appendChild(label);
    div.appendChild(input);
    container.appendChild(div);
    
    // Ativa o Places no novo input
    try {
        const autocomp = new google.maps.places.Autocomplete(input);
        autocomp.addListener('place_changed', calculateAndDisplayRoute);
        input.addEventListener('change', calculateAndDisplayRoute);
    } catch(e) {}
}

function atualizarDistanciaPelaRota(response) {
    if(!response || !response.routes || response.routes.length === 0) return;
    
    let totalMeters = 0;
    const route = response.routes[0];
    
    for (let i = 0; i < route.legs.length; i++) {
        totalMeters += route.legs[i].distance.value;
    }
    
    const idaVoltaChecked = document.getElementById('idaVoltaMaps') && document.getElementById('idaVoltaMaps').checked;
    
    if(idaVoltaChecked) {
        totalMeters *= 2; // Dobra a KM
    }
    
    kmCalculadaOculta = totalMeters / 1000;
    console.log(`Nova Distância roteirizada: ${kmCalculadaOculta} km`);
}

function calculateAndDisplayRoute() {
    const origin = document.getElementById('endPartida').value;
    const destination = document.getElementById('endDestino').value;
    
    if (!origin || !destination) return;

    // Coleta waypoints inseridos dinamicamente
    const wpInputs = document.querySelectorAll('.waypoint-input');
    const waypoints = [];
    wpInputs.forEach(inp => {
        if(inp.value.trim() !== '') {
            waypoints.push({
                location: inp.value,
                stopover: true
            });
        }
    });

    directionsService.route({
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING
    })
    .then((response) => {
        directionsRenderer.setDirections(response);
        // O event directions_changed é disparado pelo setDirections, 
        // mas as vezes asincrono. Para garantir:
        atualizarDistanciaPelaRota(response);
    })
    .catch((e) => {
        console.error("Não foi possível calcular a rota.", e);
        kmCalculadaOculta = 0;
    });
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
            if (kmCalculadaOculta === 0) {
                btn.classList.remove('loading');
                mensagemBox.textContent = "Por favor, aguarde a rota aparecer no mapa antes de enviar.";
                mensagemBox.className = 'message error';
                mensagemBox.classList.remove('hidden');
                return;
            }
            // Envia a KM que o Maps calculou na tela, ignorando partida/destino textual no backend
            payload.km_ida = kmCalculadaOculta; 
            payload.km_volta = 0;
            // Mandamos as strings só para registro do backend
            payload.endereco_partida = document.getElementById('endPartida').value;
            payload.endereco_destino = document.getElementById('endDestino').value;
        } else {
            payload.km_ida = document.getElementById('kmIda').value;
            payload.km_volta = document.getElementById('kmVolta').value || 0;
            payload.endereco_partida = "";
            payload.endereco_destino = "";
        }

        console.log("Payload montado para o Backend:", payload);

        // Comunicação REAL com a nossa API Flask/Gunicorn
        try {
            const response = await fetch('http://localhost:5001/api/km', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            btn.classList.remove('loading');
            
            if (response.ok) {
                mensagemBox.textContent = `Sucesso! Total calculado: R$ ${result.dados_sheets.Valor}`;
                mensagemBox.className = 'message success';
                
                // Limpeza total do formulário e do mapa
                form.reset();
                if(modoCalculo.checked) modoCalculo.click();
                
                // Remove os inputs dinâmicos de parada e zera contador
                const container = document.getElementById('waypointsContainer');
                if(container) container.innerHTML = '';
                waypointCount = 0;
                kmCalculadaOculta = 0;
                
                // Limpa a linha azul da rota no mapa real
                if(directionsRenderer) {
                    directionsRenderer.set('directions', null);
                }
                
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
