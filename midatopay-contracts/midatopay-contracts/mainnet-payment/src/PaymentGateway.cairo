// SPDX-License-Identifier: MIT
// PaymentGateway.cairo — Paga en el token elegido usando un Oracle dinámico (Cairo 1)
// - pay(merchant, amount: u256 (ARS), token_address, payment_id)
// - Llama a oracle.get_quote_ars_to_token(token, amount_ars) y transfiere esa cantidad (base units)

#[starknet::interface]
pub trait IERC20<TContractState> {
    fn transfer(ref self: TContractState, recipient: felt252, amount: u256) -> bool;
}

#[starknet::interface]
pub trait IDynamicFxOracleView<TContractState> {
    fn is_active(self: @TContractState) -> bool;
    fn get_quote_ars_to_token(self: @TContractState, token: felt252, amount_ars: u256) -> u256;
}

#[starknet::interface]
pub trait IPaymentGateway<TContractState> {
    fn pay(
        ref self: TContractState,
        merchant_address: felt252,
        amount: u256,           // ARS entero/off-chain
        token_address: felt252, // token a transferir y a cotizar
        payment_id: felt252
    ) -> bool;

    fn is_payment_processed(self: @TContractState, payment_id: felt252) -> bool;
    fn get_admin(self: @TContractState) -> felt252;
    fn get_oracle(self: @TContractState) -> felt252;
    fn set_oracle(ref self: TContractState, oracle: felt252);
}

#[starknet::contract]
mod PaymentGateway {
    use starknet::{get_caller_address};
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess};

    // Dispatchers + Traits necesarios (definidos en ESTE archivo)
    use super::IERC20Dispatcher;
    use super::IERC20DispatcherTrait;
    use super::IDynamicFxOracleViewDispatcher;
    use super::IDynamicFxOracleViewDispatcherTrait;

    #[storage]
    struct Storage {
        processed_payments: Map<felt252, bool>,
        admin: felt252,
        oracle_address: felt252,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        PaymentReceived: PaymentReceived,
        PaymentProcessed: PaymentProcessed,
        OracleUpdated: OracleUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct PaymentReceived {
        #[key]
        payment_id: felt252,
        #[key]
        merchant_address: felt252,
        payer_address: felt252,
        amount_ars: u256,
        token: felt252,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct PaymentProcessed {
        #[key]
        payment_id: felt252,
        merchant_address: felt252,
        token: felt252,
        amount_token: u256,
        oracle: felt252,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct OracleUpdated { admin: felt252, oracle: felt252, timestamp: u64 }

    #[constructor]
    fn constructor(ref self: ContractState, admin: felt252, oracle_address: felt252) {
        assert(admin != 0, 'admin=0');
        assert(oracle_address != 0, 'oracle=0');
        self.admin.write(admin);
        self.oracle_address.write(oracle_address);
        self.emit(Event::OracleUpdated(OracleUpdated{
            admin,
            oracle: oracle_address,
            timestamp: starknet::get_block_timestamp()
        }));
    }

    #[abi(embed_v0)]
    impl PaymentGatewayImpl of super::IPaymentGateway<ContractState> {
        fn pay(
            ref self: ContractState,
            merchant_address: felt252,
            amount: u256,           // ARS
            token_address: felt252, // token a pagar
            payment_id: felt252
        ) -> bool {
            // 1) Anti-replay / permisos
            assert(!self.processed_payments.read(payment_id), 'Payment already processed');
            assert(get_caller_address().into() == self.admin.read(), 'Only admin');
            assert(merchant_address != 0, 'merchant=0');
            assert(token_address != 0, 'token=0');
            assert(amount > 0, 'Amount > 0');

            // 2) Log de ingreso ARS + token elegido
            self.emit(Event::PaymentReceived(PaymentReceived{
                payment_id,
                merchant_address,
                payer_address: get_caller_address().into(),
                amount_ars: amount,
                token: token_address,
                timestamp: starknet::get_block_timestamp(),
            }));

            // 3) Cotizar ARS→TOKEN con el oracle externo (address seteado en storage)
            let oracle_addr: felt252 = self.oracle_address.read();
            let oracle = super::IDynamicFxOracleViewDispatcher { contract_address: oracle_addr.try_into().unwrap() };
            assert(oracle.is_active(), 'oracle paused');

            let amount_token: u256 = oracle.get_quote_ars_to_token(token_address, amount);
            assert(amount_token > 0, 'quote=0');

            // 4) Transferir TOKEN al merchant desde el balance del gateway
            let mut token = super::IERC20Dispatcher { contract_address: token_address.try_into().unwrap() };
            let ok = token.transfer(merchant_address, amount_token);
            assert(ok, 'token transfer failed');

            // 5) Marcar procesado + evento final
            self.processed_payments.write(payment_id, true);
            self.emit(Event::PaymentProcessed(PaymentProcessed{
                payment_id,
                merchant_address,
                token: token_address,
                amount_token,
                oracle: oracle_addr,
                timestamp: starknet::get_block_timestamp(),
            }));

            true
        }

        // Lecturas
        fn is_payment_processed(self: @ContractState, payment_id: felt252) -> bool {
            self.processed_payments.read(payment_id)
        }
        fn get_admin(self: @ContractState) -> felt252 { self.admin.read() }
        fn get_oracle(self: @ContractState) -> felt252 { self.oracle_address.read() }

        // Admin
        fn set_oracle(ref self: ContractState, oracle: felt252) {
            assert(get_caller_address().into() == self.admin.read(), 'Only admin');
            assert(oracle != 0, 'oracle=0');
            self.oracle_address.write(oracle);
            self.emit(Event::OracleUpdated(OracleUpdated{
                admin: self.admin.read(),
                oracle,
                timestamp: starknet::get_block_timestamp(),
            }));
        }
    }
}
