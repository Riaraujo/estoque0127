const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de CORS mais permissiva para GitHub Pages
const corsOptions = {
    origin: [
        'https://riaraujo.github.io',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuração do MongoDB
const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_PUBLIC_URL;
const DB_NAME = 'estoque_db';

let db;
let client;

// Conectar ao MongoDB
async function connectToMongoDB() {
    try {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log('Conectado ao MongoDB com sucesso!');
        
        // Inicializar dados se necessário
        await initializeData();
    } catch (error) {
        console.error('Erro ao conectar ao MongoDB:', error);
        process.exit(1);
    }
}

// Inicializar dados padrão
async function initializeData() {
    try {
        const tabelaTotalCollection = db.collection('tabelaTotalDeProdutos');
        const count = await tabelaTotalCollection.countDocuments();
        
        if (count === 0) {
            const produtosPadrao = [
                {
                    codigo: "4066756633288",
                    rct: "002760MWTPPT44",
                    precoPromocao: 100.00,
                    precoTabela: 349.99,
                    saldo: 5,
                    localizacao: ""
                },
                {
                    codigo: "0054871712258",
                    rct: "002240WFSHPT39",
                    precoPromocao: 0.00,
                    precoTabela: 499.99,
                    saldo: null,
                    localizacao: ""
                }
            ];
            
            await tabelaTotalCollection.insertMany(produtosPadrao);
            console.log('Dados iniciais inseridos na tabelaTotalDeProdutos');
        }
    } catch (error) {
        console.error('Erro ao inicializar dados:', error);
    }
}

// Middleware para log de requisições
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('Origin')}`);
    next();
});

// Middleware para verificar conexão com o banco
async function checkDatabaseConnection(req, res, next) {
    try {
        if (!db) {
            console.error('Conexão com o banco de dados não estabelecida');
            return res.status(500).json({ error: 'Erro de conexão com o banco de dados' });
        }
        
        // Testar a conexão fazendo um ping
        await db.admin().ping();
        next();
    } catch (error) {
        console.error('Erro de conexão com o banco:', error);
        return res.status(500).json({ error: 'Erro de conexão com o banco de dados' });
    }
}

// Rotas da API

// Rota de teste para verificar se o servidor está funcionando
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: 'Servidor funcionando corretamente'
    });
});

// Rota para buscar produto por código na tabela total
app.get('/api/produto/:codigo', checkDatabaseConnection, async (req, res) => {
    try {
        const { codigo } = req.params;
        console.log(`Buscando produto com código: ${codigo}`);
        
        const produto = await db.collection('tabelaTotalDeProdutos').findOne({ codigo });
        
        if (produto) {
            console.log(`Produto encontrado: ${produto.rct}`);
            res.json(produto);
        } else {
            console.log(`Produto não encontrado: ${codigo}`);
            res.status(404).json({ error: 'Produto não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar produto por RCT na tabela total
app.get('/api/produto/rct/:rct', checkDatabaseConnection, async (req, res) => {
    try {
        const { rct } = req.params;
        console.log(`Buscando produto com RCT: ${rct}`);
        
        const produto = await db.collection('tabelaTotalDeProdutos').findOne({ rct });
        
        if (produto) {
            console.log(`Produto encontrado por RCT: ${produto.codigo}`);
            res.json(produto);
        } else {
            console.log(`Produto não encontrado por RCT: ${rct}`);
            res.status(404).json({ error: 'Produto não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao buscar produto por RCT:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para adicionar produto à tabelaProdutos - CORRIGIDA
app.post('/api/adicionar-produto', checkDatabaseConnection, async (req, res) => {
    try {
        const { codigo, localizacao } = req.body;
        console.log(`Adicionando produto: ${codigo} na localização: ${localizacao}`);
        
        // Validações de entrada
        if (!codigo || typeof codigo !== 'string' || codigo.trim() === '') {
            return res.status(400).json({ error: 'Código do produto é obrigatório e deve ser uma string válida' });
        }
        
        if (!localizacao || typeof localizacao !== 'string' || localizacao.trim() === '') {
            return res.status(400).json({ error: 'Localização é obrigatória e deve ser uma string válida' });
        }
        
        // Buscar produto na tabela total
        const produtoTotal = await db.collection('tabelaTotalDeProdutos').findOne({ codigo: codigo.trim() });
        
        if (!produtoTotal) {
            console.log(`Produto não encontrado na tabela total: ${codigo}`);
            return res.status(404).json({ error: 'Produto não encontrado na tabela total' });
        }
        
        // Criar novo produto para a tabela de produtos
        const novoProduto = {
            ...produtoTotal,
            localizacao: localizacao.trim(),
            dataAdicao: new Date()
        };
        
        // Inserir na tabelaProdutos
        const resultado = await db.collection('tabelaProdutos').insertOne(novoProduto);
        console.log(`Produto adicionado com sucesso: ${resultado.insertedId}`);
        
        res.json({ 
            success: true, 
            id: resultado.insertedId,
            produto: novoProduto,
            message: 'Produto adicionado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao adicionar produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor: ' + error.message });
    }
});

// Rota para substituir todos os produtos de uma prateleira - CORRIGIDA PARA PRATELEIRAS VAZIAS
app.post('/api/substituir-produtos-prateleira', checkDatabaseConnection, async (req, res) => {
    try {
        console.log('=== INÍCIO DA REQUISIÇÃO SUBSTITUIR PRODUTOS ===');
        console.log('Body recebido:', JSON.stringify(req.body, null, 2));
        
        const { produtos, localizacao } = req.body;
        
        // Validações
        if (!produtos) {
            console.error('Campo "produtos" não fornecido');
            return res.status(400).json({ error: 'Campo "produtos" é obrigatório' });
        }
        
        if (!Array.isArray(produtos)) {
            console.error('Campo "produtos" não é um array:', typeof produtos);
            return res.status(400).json({ error: 'Campo "produtos" deve ser um array' });
        }
        
        if (produtos.length === 0) {
            console.error('Array de produtos está vazio');
            return res.status(400).json({ error: 'Lista de produtos não pode estar vazia' });
        }
        
        if (!localizacao) {
            console.error('Campo "localização" não fornecido');
            return res.status(400).json({ error: 'Campo "localização" é obrigatório' });
        }
        
        console.log(`Processando ${produtos.length} produtos para localização: ${localizacao}`);
        
        // Verificar e remover produtos existentes
        const produtosExistentes = await db.collection('tabelaProdutos').find({ localizacao }).toArray();
        let produtosRemovidos = 0;

        if (produtosExistentes.length > 0) {
            console.log(`Removendo ${produtosExistentes.length} produtos existentes...`);
            const deleteResult = await db.collection('tabelaProdutos').deleteMany({ localizacao });
            produtosRemovidos = deleteResult.deletedCount;
            console.log(`Produtos removidos: ${produtosRemovidos}`);
        }

        // Preparar novos produtos para inserção
        const produtosParaInserir = [];
        const produtosNaoEncontrados = [];
        
        for (const codigo of produtos) {
            console.log(`Processando produto: ${codigo}`);
            
            const produtoTotal = await db.collection('tabelaTotalDeProdutos').findOne({ codigo });
            
            if (!produtoTotal) {
                console.error(`Produto não encontrado: ${codigo}`);
                produtosNaoEncontrados.push(codigo);
                continue;
            }
            
            // Criar novo objeto sem o _id original
            const { _id, ...produtoSemId } = produtoTotal;
            const novoProduto = {
                ...produtoSemId,
                localizacao,
                dataAdicao: new Date()
            };
            
            produtosParaInserir.push(novoProduto);
        }
        
        // Verificar se todos os produtos foram encontrados
        if (produtosNaoEncontrados.length > 0) {
            console.error('Produtos não encontrados:', produtosNaoEncontrados);
            return res.status(404).json({
                error: 'Alguns produtos não foram encontrados',
                produtosNaoEncontrados
            });
        }
        
        // Inserir novos produtos
        console.log(`Inserindo ${produtosParaInserir.length} novos produtos...`);
        const resultado = await db.collection('tabelaProdutos').insertMany(produtosParaInserir);
        console.log(`Produtos inseridos com sucesso: ${resultado.insertedCount}`);
        
        // Resposta de sucesso
        const response = {
            success: true,
            produtosAdicionados: resultado.insertedCount,
            produtosRemovidos,
            localizacao,
            produtos: produtosParaInserir.map(p => ({
                codigo: p.codigo,
                rct: p.rct,
                localizacao: p.localizacao,
                dataAdicao: p.dataAdicao
            }))
        };
        
        console.log('=== OPERAÇÃO CONCLUÍDA COM SUCESSO ===');
        console.log(JSON.stringify(response, null, 2));
        
        return res.json(response);
        
    } catch (error) {
        console.error('=== ERRO NA OPERAÇÃO ===');
        console.error('Tipo de erro:', error.name);
        console.error('Mensagem:', error.message);
        console.error('Stack trace:', error.stack);
        
        if (error.code === 11000) {
            console.error('Erro de duplicação detectado');
            return res.status(409).json({
                error: 'Conflito de dados',
                message: 'Foi detectada uma tentativa de inserir dados duplicados'
            });
        }
        
        return res.status(500).json({
            error: 'Erro interno do servidor',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Rota para buscar produtos por localização
app.get('/api/produtos/localizacao/:localizacao', checkDatabaseConnection, async (req, res) => {
    try {
        const { localizacao } = req.params;
        console.log(`Buscando produtos na localização: ${localizacao}`);
        
        const produtos = await db.collection('tabelaProdutos').find({ localizacao }).toArray();
        console.log(`Encontrados ${produtos.length} produtos na localização ${localizacao}`);
        
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar produtos por localização:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar todos os produtos da tabelaProdutos
app.get('/api/produtos', checkDatabaseConnection, async (req, res) => {
    try {
        console.log('Buscando todos os produtos da tabelaProdutos');
        const produtos = await db.collection('tabelaProdutos').find({}).toArray();
        console.log(`Encontrados ${produtos.length} produtos na tabelaProdutos`);
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar todos os produtos da tabelaTotalDeProdutos
app.get('/api/produtos-total', checkDatabaseConnection, async (req, res) => {
    try {
        console.log('Buscando todos os produtos da tabelaTotalDeProdutos');
        const produtos = await db.collection('tabelaTotalDeProdutos').find({}).toArray();
        console.log(`Encontrados ${produtos.length} produtos na tabelaTotalDeProdutos`);
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar produtos totais:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para remover produto da tabelaProdutos
app.delete('/api/produto/:id', checkDatabaseConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const { ObjectId } = require('mongodb');
        
        console.log(`Removendo produto com ID: ${id}`);
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        
        const resultado = await db.collection('tabelaProdutos').deleteOne({ _id: new ObjectId(id) });
        
        if (resultado.deletedCount === 1) {
            console.log(`Produto removido com sucesso: ${id}`);
            res.json({ success: true, message: 'Produto removido com sucesso' });
        } else {
            console.log(`Produto não encontrado para remoção: ${id}`);
            res.status(404).json({ error: 'Produto não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao remover produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para atualizar localização de um produto
app.put('/api/produto/:id/localizacao', checkDatabaseConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const { localizacao } = req.body;
        const { ObjectId } = require('mongodb');
        
        console.log(`Atualizando localização do produto ${id} para: ${localizacao}`);
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        
        const resultado = await db.collection('tabelaProdutos').updateOne(
            { _id: new ObjectId(id) },
            { $set: { localizacao, dataAtualizacao: new Date() } }
        );
        
        if (resultado.matchedCount === 1) {
            console.log(`Localização atualizada com sucesso para produto: ${id}`);
            res.json({ success: true, message: 'Localização atualizada com sucesso' });
        } else {
            console.log(`Produto não encontrado para atualização: ${id}`);
            res.status(404).json({ error: 'Produto não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao atualizar localização:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar produtos por código de barras (múltiplos resultados)
app.get('/api/buscar/:codigo', checkDatabaseConnection, async (req, res) => {
    try {
        const { codigo } = req.params;
        console.log(`Buscando produto completo com código: ${codigo}`);
        
        // Buscar na tabela de produtos (produtos já adicionados ao estoque)
        const produtosEstoque = await db.collection('tabelaProdutos').find({ codigo }).toArray();
        
        // Buscar na tabela total (informações do produto)
        const produtoTotal = await db.collection('tabelaTotalDeProdutos').findOne({ codigo });
        
        console.log(`Produto total encontrado: ${produtoTotal ? 'Sim' : 'Não'}`);
        console.log(`Produtos no estoque: ${produtosEstoque.length}`);
        
        res.json({
            produtoTotal,
            produtosEstoque,
            quantidadeEstoque: produtosEstoque.length
        });
    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar produtos por RCT (múltiplos resultados)
app.get('/api/buscar/rct/:rct', checkDatabaseConnection, async (req, res) => {
    try {
        const { rct } = req.params;
        console.log(`Buscando produto completo com RCT: ${rct}`);
        
        // Buscar na tabela total primeiro
        const produtoTotal = await db.collection('tabelaTotalDeProdutos').findOne({ rct });
        
        if (!produtoTotal) {
            console.log(`Produto não encontrado por RCT: ${rct}`);
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        
        // Buscar na tabela de produtos usando o código
        const produtosEstoque = await db.collection('tabelaProdutos').find({ codigo: produtoTotal.codigo }).toArray();
        
        console.log(`Produto encontrado por RCT: ${produtoTotal.codigo}`);
        console.log(`Produtos no estoque: ${produtosEstoque.length}`);
        
        res.json({
            produtoTotal,
            produtosEstoque,
            quantidadeEstoque: produtosEstoque.length
        });
    } catch (error) {
        console.error('Erro ao buscar produto por RCT:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para servir o arquivo HTML principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para servir arquivos estáticos
app.get('/:filename', (req, res) => {
    const filename = req.params.filename;
    if (filename.endsWith('.html') || filename.endsWith('.css') || filename.endsWith('.js') || filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
        res.sendFile(path.join(__dirname, filename));
    } else {
        res.status(404).send('Arquivo não encontrado');
    }
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
    console.error('Erro não tratado:', error);
    res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// Iniciar servidor
async function startServer() {
    await connectToMongoDB();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Servidor rodando na porta ${PORT}`);
        console.log(`Acesse: http://localhost:${PORT}`);
        console.log(`CORS configurado para GitHub Pages: https://riaraujo.github.io`);
    });
}

// Tratamento de encerramento gracioso
process.on('SIGINT', async () => {
    console.log('Encerrando servidor...');
    if (client) {
        await client.close();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Encerrando servidor...');
    if (client) {
        await client.close();
    }
    process.exit(0);
});

startServer().catch(console.error);

