from django.http import HttpResponse

def home_view(request):
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>WebSocket Product Analyzer</title>
    </head>
    <body>
        <h1>Product Identifier (WebSocket)</h1>
        <input type="file" id="imageFile" accept="image/*">
        <button onclick="sendImage()">Analyze Image</button>
        <div id="result"></div>

        <script>
            let socket = new WebSocket('ws://' + window.location.host + '/ws/analyze/');

            socket.onmessage = function(event) {
                const data = JSON.parse(event.data);
                const resultDiv = document.getElementById('result');
                if (data.type === "company") {
                    resultDiv.innerHTML += `<p><strong>Company:</strong> ${data.value}</p>`;
                } else if (data.type === "product_type") {
                    resultDiv.innerHTML += `<p><strong>Product Type:</strong> ${data.value}</p>`;
                } else if (data.type === "boycott") {
                    resultDiv.innerHTML += `<p><strong>boycott:</strong> ${data.value}</p>`;
                } else if (data.type === "cause") {
                    resultDiv.innerHTML += `<p><strong>Cause:</strong> ${data.value}</p>`;
                } else if (data.type === "alternative") {
                    let html = '<div class="alternatives-container">';
                    html += '<h3>Alternative Products:</h3>';
                    
                    data.value.forEach(alt => {
                        html += `
                        <div class="alternative-product" style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            <div><strong>Product:</strong> ${alt.product_name || 'N/A'}</div>
                            <div><strong>Company:</strong> ${alt.company_name || 'N/A'}</div>
                            <div><strong>Type:</strong> ${alt.product_type || 'N/A'}</div>
                            <div><strong>image:</strong> <img src="${alt.image_url}" style="max-width: 200px;" /></div>
                            ${alt.company_website ? `<div><strong>Website:</strong> <a href="${alt.company_website}" target="_blank">${alt.company_website}</a></div>` : ''}
                            ${alt.is_exact_match === false ? '<div style="color: #666;">(Similar product type match)</div>' : ''}
                        </div>`;
                    });
                    
                    html += '</div>';
                    resultDiv.innerHTML += html;
                } else if (data.type === "error") {
                    resultDiv.innerHTML += `<p style="color:red;">Error: ${data.value}</p>`;
                }
            };

            function sendImage() {
                const file = document.getElementById('imageFile').files[0];
                const reader = new FileReader();
                reader.onload = function() {
                    const base64 = reader.result.split(',')[1];
                    socket.send(JSON.stringify({ image_data: base64 }));
                    document.getElementById('result').innerHTML = '<h3>Analyzing...</h3>';
                };
                reader.readAsDataURL(file);
            }
        </script>
    </body>
    </html>
    """
    return HttpResponse(html_content)
