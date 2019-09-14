import { ContractWrappers } from '@0x/contract-wrappers';
import { MarketOperation, SignedOrder } from '@0x/types';
import { BigNumber } from '@0x/utils';
import { SupportedProvider, Web3Wrapper } from '@0x/web3-wrapper';
import * as _ from 'lodash';

import { constants } from '../constants';
import { SwapQuote, SwapQuoteConsumerError, SwapQuoteExecutionOpts } from '../types';

export const swapQuoteConsumerUtils = {
    async getTakerAddressOrThrowAsync(
        provider: SupportedProvider,
        opts: Partial<SwapQuoteExecutionOpts>,
    ): Promise<string> {
        const takerAddress = await swapQuoteConsumerUtils.getTakerAddressAsync(provider, opts);
        if (takerAddress === undefined) {
            throw new Error(SwapQuoteConsumerError.NoAddressAvailable);
        } else {
            return takerAddress;
        }
    },
    async getTakerAddressAsync(
        provider: SupportedProvider,
        opts: Partial<SwapQuoteExecutionOpts>,
    ): Promise<string | undefined> {
        if (opts.takerAddress !== undefined) {
            return opts.takerAddress;
        } else {
            const web3Wrapper = new Web3Wrapper(provider);
            const availableAddresses = await web3Wrapper.getAvailableAddressesAsync();
            const firstAvailableAddress = _.head(availableAddresses);
            if (firstAvailableAddress !== undefined) {
                return firstAvailableAddress;
            } else {
                return undefined;
            }
        }
    },
    async getEthAndWethBalanceAsync(
        provider: SupportedProvider,
        contractWrappers: ContractWrappers,
        takerAddress: string,
    ): Promise<[BigNumber, BigNumber]> {
        const web3Wrapper = new Web3Wrapper(provider);
        const ethBalance = await web3Wrapper.getBalanceInWeiAsync(takerAddress);
        const wethBalance = await contractWrappers.weth9.balanceOf.callAsync(takerAddress);
        return [ethBalance, wethBalance];
    },
    isValidForwarderSwapQuote(swapQuote: SwapQuote, wethAssetData: string): boolean {
        return (
            swapQuoteConsumerUtils.isValidForwarderSignedOrders(swapQuote.orders, wethAssetData) &&
            swapQuoteConsumerUtils.isValidForwarderSignedOrders(swapQuote.feeOrders, wethAssetData)
        );
    },
    isValidForwarderSignedOrders(orders: SignedOrder[], wethAssetData: string): boolean {
        return _.every(orders, order => swapQuoteConsumerUtils.isValidForwarderSignedOrder(order, wethAssetData));
    },
    isValidForwarderSignedOrder(order: SignedOrder, wethAssetData: string): boolean {
        return order.takerAssetData === wethAssetData;
    },
    optimizeOrdersForMarketExchangeOperation(orders: SignedOrder[], operation: MarketOperation): SignedOrder[] {
        return _.map(orders, (order: SignedOrder, index: number) => {
            const optimizedOrder = _.clone(order);
            if (operation === MarketOperation.Sell && index !== 0) {
                optimizedOrder.takerAssetData = constants.NULL_BYTES;
            } else if (index !== 0) {
                optimizedOrder.makerAssetData = constants.NULL_BYTES;
            }
            return optimizedOrder;
        });
    },
};
