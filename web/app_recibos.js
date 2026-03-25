document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('arquivoRecibo');
    const previewContainer = document.getElementById('previewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const fileNameDisplay = document.getElementById('fileName');
    const form = document.getElementById('reciboForm');
    const submitBtn = document.getElementById('submitBtn');
    const mensagemBox = document.getElementById('mensagem');
    const uploadTexts = document.getElementById('uploadTexts');

    // Manipula a seleção da imagem/PDF para mostrar na tela (Preview)
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            fileNameDisplay.textContent = file.name;
            
            // Só exibe miniatura se for imagem (ignora miniatura se for PDF)
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    imagePreview.src = evt.target.result;
                    imagePreview.style.display = 'inline-block';
                    previewContainer.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else if (file.type === 'application/pdf') {
                imagePreview.style.display = 'none';
                previewContainer.style.display = 'block';
                fileNameDisplay.textContent = "📄 Documento PDF Selecionado: " + file.name;
            } else {
                imagePreview.style.display = 'none';
                previewContainer.style.display = 'none';
            }
            uploadTexts.style.display = 'none'; // Esconde os Textos bonitos de Upload
        } else {
            previewContainer.style.display = 'none';
            uploadTexts.style.display = 'block';
        }
    });

    // Submissão do form para o Back-End em Python
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const tipoDespesa = document.getElementById('tipoDespesa').value;
        const file = fileInput.files[0];
        
        if(!tipoDespesa) {
            alert('Por favor, selecione onde salvar a despesa.');
            return;
        }
        if(!file) {
            alert('Por favor, anexe a foto do recibo.');
            return;
        }

        // Prepara visual de carregamento
        submitBtn.classList.add('loading');
        mensagemBox.className = 'message hidden';
        
        const formData = new FormData();
        formData.append("categoria", tipoDespesa);
        formData.append("documento", file);

        try {
            // Enviando a Imagem ao servidor backend Python
            const targetUrl = `/api/recibo`;
            const response = await fetch(targetUrl, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                // Sucesso!
                const val = result.dados_extraidos.valor_total || result.dados_extraidos.Valor || "?";
                const desc = result.dados_extraidos.descricao || result.dados_extraidos.Descricao || "Recibo";
                
                // Exibe imagem com link pro Drive
                let driveHtml = "";
                if(result.link_foto && result.link_foto !== "Sem Link") {
                    driveHtml = `<br><a href="${result.link_foto}" target="_blank" style="color: white; text-decoration: underline;">Abrir comprovante salvo no Drive</a>`;
                }
                
                mensagemBox.innerHTML = `✅ <strong>Sucesso!</strong> Analisado e salvo no Drive e Planilha de ${tipoDespesa}!<br>Despesa: ${desc} - R$ ${val}${driveHtml}`;
                mensagemBox.className = 'message success';
                
                // Limpa o form
                form.reset();
                previewContainer.style.display = 'none';
                uploadTexts.style.display = 'block';
                
                // Repõe o tipo selecionado antes do reset
                const savedTipo = localStorage.getItem('lastTipoDespesa') || tipoDespesa;
                document.getElementById('tipoDespesa').value = savedTipo;
                const r = document.querySelector(`input[name="tipoDespesaGroup"][value="${savedTipo}"]`);
                if(r) r.checked = true;
            } else {
                mensagemBox.textContent = `Erro do Servidor: ${result.erro}`;
                mensagemBox.className = 'message error';
            }
        } catch (err) {
            console.error(err);
            mensagemBox.textContent = `Falha ao comunicar com o servidor: ${err.message}. A porta 5001 está aberta no LXC? O proxy bloqueou o tamanho?`;
            mensagemBox.className = 'message error';
        } finally {
            submitBtn.classList.remove('loading');
        }
    });
});
