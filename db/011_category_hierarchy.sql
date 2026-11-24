-- Hierarquia de categorias: preserva IDs, produtos, pedidos e categorias legadas.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES categories(id);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url text;
CREATE INDEX IF NOT EXISTS categories_parent_idx ON categories(parent_id,sort_order);
INSERT INTO categories(name,slug,sort_order) VALUES
('Vestuário','vestuario',0),
('Relógios','relogios',1),
('Calçados','calcados',2),
('Acessórios','acessorios',3)
ON CONFLICT(slug) DO UPDATE SET name=excluded.name,sort_order=excluded.sort_order;
INSERT INTO categories(name,slug,parent_id,sort_order)
SELECT seed.name,seed.slug,p.id,seed.position FROM (VALUES
('Camisetas','camisetas','vestuario',0),
('Camisas','camisas','vestuario',1),
('Polos','polos','vestuario',2),
('Calças','calcas','vestuario',3),
('Bermudas e shorts','bermudas-e-shorts','vestuario',4),
('Ternos e alfaiataria','ternos-e-alfaiataria','vestuario',5),
('Casacos e jaquetas','casacos-e-jaquetas','vestuario',6),
('Vestuário Esportivo','vestuario-esportivo','vestuario',7),
('Roupas íntimas','roupas-intimas','vestuario',8),
('Relógios clássicos','relogios-classicos','relogios',0),
('Relógios esportivos','relogios-esportivos','relogios',1),
('Relógios digitais','relogios-digitais','relogios',2),
('Smartwatches','smartwatches','relogios',3),
('Pulseiras para relógios','pulseiras-para-relogios','relogios',4),
('Estojos e organizadores','estojos-e-organizadores','relogios',5),
('Tênis casuais','tenis-casuais','calcados',0),
('Tênis esportivos','tenis-esportivos','calcados',1),
('Sapatos sociais','sapatos-sociais','calcados',2),
('Mocassins','mocassins','calcados',3),
('Botas','botas','calcados',4),
('Chinelos e sandálias','chinelos-e-sandalias','calcados',5),
('Óculos de sol','oculos-de-sol','acessorios',0),
('Pulseiras','pulseiras','acessorios',1),
('Correntes e colares','correntes-e-colares','acessorios',2),
('Anéis','aneis','acessorios',3),
('Carteiras','carteiras','acessorios',4),
('Cintos','cintos','acessorios',5),
('Bonés e chapéus','bones-e-chapeus','acessorios',6),
('Gravatas','gravatas','acessorios',7),
('Bolsas e mochilas','bolsas-e-mochilas','acessorios',8)
) AS seed(name,slug,parent_slug,position) JOIN categories p ON p.slug=seed.parent_slug
ON CONFLICT(slug) DO UPDATE SET parent_id=excluded.parent_id,sort_order=excluded.sort_order,name=excluded.name;
-- Atribuição explícita dos modelos conhecidos; produtos novos não são classificados por suposição.
UPDATE products p SET category_id=dest.id
FROM (VALUES
('binbond-b7012','relogios-classicos'),
('poedagar-930','relogios-classicos'),
('poedagar-924','relogios-classicos'),
('calca-oxford-tradicional','calcas'),
('calca-bolso-forrado-slim','calcas'),
('terno-slim-alfaiataria','ternos-e-alfaiataria'),
('conjunto-polo-shorts','polos'),
('conjunto-tactel-praia','bermudas-e-shorts'),
('pulseira-trevo','pulseiras'),
('kit-3-pulseiras-masculinas-douradas-aco-inox-316l','pulseiras'),
('kit-corrente-pulseira-4mm-aco-inoxidavel-prateado','correntes-e-colares'),
('binbond-b1885','relogios-classicos'),
('oculos-de-sol-polarizado-masculino-redondo','oculos-de-sol'),
('oculos-de-sol-hexagonal-masculino-estilo-retro','oculos-de-sol'),
('estojo-porta-relogios-couro-sintetico-6-12-nichos','estojos-e-organizadores'),
('camiseta-dry-fit-malha-fria-1-unidade','vestuario-esportivo'),
('camiseta-dry-fit-malha-fria-2-unidades','vestuario-esportivo'),
('camiseta-dry-fit-malha-fria-4-unidades','vestuario-esportivo'),
('sapato-social-masculino-loafer-mocassim-casual','mocassins'),
('sapato-mocassim-masculino-social','mocassins'),
('sapato-social-masculino-fosco-verniz','sapatos-sociais'),
('tenis-masculino-branco-casual-minimalista','tenis-casuais'),
('tenis-masculino-elegante-sola-alta-moderno','tenis-casuais'),
('tenis-masculino-sem-cadarco-estilo-slip','tenis-casuais'),
('camisa-masculina-social-slim-fit-preto','camisas'),
('camisa-masculina-social-slim-fit-branco','camisas'),
('camisa-masculina-social-slim-fit-azul-marinho','camisas'),
('camisa-masculina-social-slim-fit-azul-claro','camisas'),
('camisa-masculina-social-slim-fit-verde-militar','camisas'),
('camisa-masculina-social-slim-fit-vinho','camisas'),
('camisa-masculina-social-slim-fit-rosa-salmao','camisas'),
('camisa-masculina-social-slim-fit-bege','camisas'),
('camisa-masculina-social-slim-fit-cinza','camisas'),
('camisa-masculina-social-slim-fit-pessego','camisas'),
('kit-2-camisas-masculinas-linho-manga-curta-preto-branco','camisas')
) AS mapping(product_slug,category_slug) JOIN categories dest ON dest.slug=mapping.category_slug
JOIN categories root ON root.id=dest.parent_id
WHERE p.slug=mapping.product_slug AND p.category_id IN (SELECT id FROM categories WHERE slug IN ('vestuario','relogios','calcados','acessorios','vestuario-esportivo'));
