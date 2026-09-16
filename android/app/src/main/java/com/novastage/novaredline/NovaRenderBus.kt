package com.novastage.novaredline

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed class NovaRenderState {
    data object Idle : NovaRenderState()
    data class Running(val progress: Float, val status: String) : NovaRenderState()
    data class Completed(val result: NovaMasterResult) : NovaRenderState()
    data class Failed(val message: String) : NovaRenderState()
    data object Cancelled : NovaRenderState()
}

object NovaRenderBus {
    private val _state = MutableStateFlow<NovaRenderState>(NovaRenderState.Idle)
    val state: StateFlow<NovaRenderState> = _state.asStateFlow()
    fun emit(state: NovaRenderState) { _state.value = state }
}
